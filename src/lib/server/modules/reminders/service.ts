// Reminders (docs/design.md, "Reminders"): the app reads and saves a person's settings and their devices' push
// subscriptions; the worker finds who is due, checks under each person's identity that what the reminder is about is
// still missing, records the send (once per reminder and day) and delivers it to each device. Delivery itself is
// passed in, so this module makes no network calls.
import { and, eq, inArray, isNull, sql } from 'drizzle-orm';
import { withUser, type Database } from '../../db/identity.ts';
import {
	DEFAULT_REMINDERS,
	REMINDER_KINDS,
	dueReminders,
	type ReminderKind,
	type ReminderSettings
} from '../../../shared/reminders.ts';
import { dayCompletions, diaryEntries } from '../diary/index.ts';
import { weightEntries } from '../body/index.ts';
import { profiles } from '../goals/index.ts';
import type { Language } from '../../../shared/languages.ts';
import { pushSubscriptions, reminderSends, reminderSettings } from './schema.ts';

/** The browser's PushSubscription as JSON. */
export interface PushSubscriptionInput {
	endpoint: string;
	keys: { p256dh: string; auth: string };
}

export interface Delivery {
	endpoint: string;
	p256dh: string;
	auth: string;
	/** The person's interface language as stored (shared/languages.ts); the text follows it. */
	language: Language;
}

/** What delivering one notification to one device came to. */
export type DeliveryResult = 'sent' | 'gone' | 'failed';

/** A device is dropped after this many failed deliveries in a row (gone is dropped at once). */
const MAX_FAILURES = 5;

const COLUMN: Record<ReminderKind, 'breakfast' | 'lunch' | 'dinner' | 'weighIn' | 'dayComplete'> = {
	breakfast: 'breakfast',
	lunch: 'lunch',
	dinner: 'dinner',
	weigh_in: 'weighIn',
	day_complete: 'dayComplete'
};
const hhmm = (t: string | null) => (t ? t.slice(0, 5) : null);

export function createReminders(db: Database) {
	return {
		async settings(userId: string, zone: string): Promise<ReminderSettings> {
			const [row] = await withUser(db, userId, (tx) =>
				tx.select().from(reminderSettings).where(eq(reminderSettings.userId, userId))
			);
			if (!row) return { ...DEFAULT_REMINDERS, zone };
			return {
				zone: row.zone,
				times: Object.fromEntries(
					REMINDER_KINDS.map((k) => [k, hhmm(row[COLUMN[k]])])
				) as ReminderSettings['times'],
				quietStart: hhmm(row.quietStart)!,
				quietEnd: hhmm(row.quietEnd)!
			};
		},

		async saveSettings(userId: string, s: ReminderSettings): Promise<void> {
			const values = {
				zone: s.zone,
				...Object.fromEntries(REMINDER_KINDS.map((k) => [COLUMN[k], s.times[k]])),
				quietStart: s.quietStart,
				quietEnd: s.quietEnd,
				updatedAt: new Date()
			};
			await withUser(db, userId, (tx) =>
				tx
					.insert(reminderSettings)
					.values({ userId, ...values } as typeof reminderSettings.$inferInsert)
					.onConflictDoUpdate({ target: reminderSettings.userId, set: values })
			);
		},

		async subscribe(userId: string, sub: PushSubscriptionInput): Promise<void> {
			await withUser(db, userId, (tx) =>
				tx
					.insert(pushSubscriptions)
					.values({ userId, endpoint: sub.endpoint, p256dh: sub.keys.p256dh, auth: sub.keys.auth })
					.onConflictDoUpdate({
						target: [pushSubscriptions.userId, pushSubscriptions.endpoint],
						set: { p256dh: sub.keys.p256dh, auth: sub.keys.auth }
					})
			);
		},

		async unsubscribe(userId: string, endpoint: string): Promise<void> {
			await withUser(db, userId, (tx) =>
				tx
					.delete(pushSubscriptions)
					.where(
						and(eq(pushSubscriptions.userId, userId), eq(pushSubscriptions.endpoint, endpoint))
					)
			);
		},

		/** Whether this device (endpoint) is subscribed for the person. */
		async subscribed(userId: string, endpoint: string): Promise<boolean> {
			const rows = await withUser(db, userId, (tx) =>
				tx
					.select({ id: pushSubscriptions.id })
					.from(pushSubscriptions)
					.where(eq(pushSubscriptions.endpoint, endpoint))
			);
			return rows.length > 0;
		}
	};
}

/**
 * The worker's pass at `now`: for each person with a reminder on and a device, the reminders due, still needed and
 * not sent yet are recorded and delivered. Returns how many reminders were sent.
 */
export async function sendDueReminders(
	worker: Database,
	now: Date,
	deliver: (to: Delivery, kind: ReminderKind) => Promise<DeliveryResult>
): Promise<number> {
	const candidates = (await worker.execute<{
		user_id: string;
		zone: string;
		breakfast: string | null;
		lunch: string | null;
		dinner: string | null;
		weigh_in: string | null;
		day_complete: string | null;
		quiet_start: string;
		quiet_end: string;
	}>(sql`select * from app_reminder_candidates()`)) as unknown as {
		user_id: string;
		zone: string;
		quiet_start: string;
		quiet_end: string;
		[k: string]: string | null;
	}[];
	let sent = 0;
	for (const c of candidates) {
		const settings: ReminderSettings = {
			zone: c.zone,
			times: Object.fromEntries(
				REMINDER_KINDS.map((k) => [k, hhmm(c[k])])
			) as ReminderSettings['times'],
			quietStart: hhmm(c.quiet_start)!,
			quietEnd: hhmm(c.quiet_end)!
		};
		const due = dueReminders(settings, now, new Set());
		if (!due.length) continue;
		// Under the person's identity: still needed? Not sent yet? Record it, and read their devices.
		const { kinds, devices } = await withUser(worker, c.user_id, async (tx) => {
			const kinds: ReminderKind[] = [];
			for (const { kind, localDate } of due) {
				const done =
					kind === 'weigh_in'
						? await tx
								.select({ id: weightEntries.id })
								.from(weightEntries)
								.where(and(eq(weightEntries.localDate, localDate), isNull(weightEntries.deletedAt)))
								.limit(1)
						: kind === 'day_complete'
							? await tx
									.select({ d: dayCompletions.localDate })
									.from(dayCompletions)
									.where(eq(dayCompletions.localDate, localDate))
									.limit(1)
							: await tx
									.select({ id: diaryEntries.id })
									.from(diaryEntries)
									.where(
										and(
											eq(diaryEntries.localDate, localDate),
											eq(diaryEntries.meal, kind),
											isNull(diaryEntries.deletedAt)
										)
									)
									.limit(1);
				if (done.length) continue;
				const recorded = await tx
					.insert(reminderSends)
					.values({ userId: c.user_id, kind, localDate })
					.onConflictDoNothing()
					.returning({ kind: reminderSends.kind });
				if (recorded.length) kinds.push(kind);
			}
			const [profile] = kinds.length
				? await tx.select({ language: profiles.language }).from(profiles)
				: [];
			const devices = kinds.length
				? await tx
						.select({
							id: pushSubscriptions.id,
							endpoint: pushSubscriptions.endpoint,
							p256dh: pushSubscriptions.p256dh,
							auth: pushSubscriptions.auth,
							failures: pushSubscriptions.failures
						})
						.from(pushSubscriptions)
				: [];
			return {
				kinds,
				devices: devices.map((d) => ({ ...d, language: profile?.language ?? 'en' }))
			};
		});
		// Delivered outside the transaction: a slow push service never holds a database connection.
		for (const kind of kinds) {
			const outcomes = await Promise.all(
				devices.map(async (d) => ({ d, r: await deliver(d, kind) }))
			);
			sent++;
			await withUser(worker, c.user_id, async (tx) => {
				const gone = outcomes
					.filter(({ d, r }) => r === 'gone' || (r === 'failed' && d.failures + 1 >= MAX_FAILURES))
					.map(({ d }) => d.id);
				if (gone.length)
					await tx.delete(pushSubscriptions).where(inArray(pushSubscriptions.id, gone));
				for (const { d, r } of outcomes) {
					if (gone.includes(d.id)) continue;
					await tx
						.update(pushSubscriptions)
						.set(r === 'sent' ? { lastSentAt: now, failures: 0 } : { failures: d.failures + 1 })
						.where(eq(pushSubscriptions.id, d.id));
				}
			});
		}
	}
	return sent;
}
