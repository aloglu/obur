// Reminders (docs/design.md, "Reminders"): the app reads and saves a person's settings and their devices' push
// subscriptions; the worker finds who is due, checks under each person's identity that what the reminder is about is
// still missing, records the send (once per reminder and day) and delivers it to each device. Delivery itself is
// passed in, so this module makes no network calls.
import { and, eq, inArray, isNull, sql } from 'drizzle-orm';
import { withUser, type Database } from '../../db/identity.ts';
import { describeError } from '../../log.ts';
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

/**
 * A device is dropped after failed deliveries on this many days in a row (gone is dropped at once). Retries within a
 * day count once: tries every five minutes had counted each, so a 25-minute outage removed devices (2026-11-22 Gemini
 * audit, G06).
 */
const MAX_FAILURES = 5;
/** Reminder devices kept for one person. */
export const MAX_DEVICES = 20;
/** A failure this long after the last counted one counts again. */
const FAILURE_COUNTS_AGAIN_MS = 20 * 60 * 60 * 1000;

/** A device's failure count and time after one more failed delivery at `now`. */
export function afterFailure(
	d: { failures: number; failedAt: Date | null },
	now: Date
): { failures: number; failedAt: Date } {
	if (d.failedAt && now.getTime() - d.failedAt.getTime() < FAILURE_COUNTS_AGAIN_MS)
		return { failures: d.failures, failedAt: d.failedAt };
	return { failures: d.failures + 1, failedAt: now };
}

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
			await withUser(db, userId, async (tx) => {
				await tx
					.insert(pushSubscriptions)
					.values({ userId, endpoint: sub.endpoint, p256dh: sub.keys.p256dh, auth: sub.keys.auth })
					.onConflictDoUpdate({
						target: [pushSubscriptions.userId, pushSubscriptions.endpoint],
						set: { p256dh: sub.keys.p256dh, auth: sub.keys.auth }
					});
				// At most MAX_DEVICES each: the ones longest without a reminder go, so old phones and browsers never
				// pile up (each pass sends to every device; 2026-11-22 Gemini audit, G19).
				await tx.execute(sql`delete from push_subscriptions where user_id = ${userId} and id not in (
					select id from push_subscriptions where user_id = ${userId}
					order by greatest(created_at, coalesce(last_sent_at, created_at)) desc, id limit ${MAX_DEVICES})`);
			});
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
		// One person's failure (a database error, a zone no longer known) never stops the others' reminders
		// (2026-11-22 Gemini audit, G28).
		try {
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
				const kinds: { kind: ReminderKind; localDate: string }[] = [];
				for (const { kind, localDate } of due) {
					const done =
						kind === 'weigh_in'
							? await tx
									.select({ id: weightEntries.id })
									.from(weightEntries)
									.where(
										and(eq(weightEntries.localDate, localDate), isNull(weightEntries.deletedAt))
									)
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
					if (recorded.length) kinds.push({ kind, localDate });
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
								failures: pushSubscriptions.failures,
								failedAt: pushSubscriptions.failedAt
							})
							.from(pushSubscriptions)
					: [];
				return {
					kinds,
					devices: devices.map((d) => ({ ...d, language: profile?.language ?? 'en' }))
				};
			});
			// Delivered outside the transaction: a slow push service never holds a database connection. Several reminders
			// can be due in one pass: each device's failure count carries from one to the next, and a device dropped for
			// one gets none of the rest.
			let live = devices;
			for (const { kind, localDate } of kinds) {
				if (!live.length) break;
				const outcomes = await Promise.all(
					live.map(async (d) => ({ d, r: await deliver(d, kind) }))
				);
				// Counted as sent only when some device took it.
				const reached = outcomes.some(({ r }) => r === 'sent');
				if (reached) sent++;
				const gone = outcomes
					.filter(
						({ d, r }) =>
							r === 'gone' || (r === 'failed' && afterFailure(d, now).failures >= MAX_FAILURES)
					)
					.map(({ d }) => d.id);
				// No device took it because the push service failed for now: the day's mark goes, so a later pass within
				// the hour tries again (2026-11-21 audit, A46). Once any device has it, the mark stays: no duplicates.
				const retry =
					!reached && outcomes.some(({ d, r }) => r === 'failed' && !gone.includes(d.id));
				await withUser(worker, c.user_id, async (tx) => {
					if (retry)
						await tx
							.delete(reminderSends)
							.where(
								and(
									eq(reminderSends.userId, c.user_id),
									eq(reminderSends.kind, kind),
									eq(reminderSends.localDate, localDate)
								)
							);
					if (gone.length)
						await tx.delete(pushSubscriptions).where(inArray(pushSubscriptions.id, gone));
					for (const { d, r } of outcomes) {
						if (gone.includes(d.id)) continue;
						await tx
							.update(pushSubscriptions)
							.set(
								r === 'sent'
									? { lastSentAt: now, failures: 0, failedAt: null }
									: afterFailure(d, now)
							)
							.where(eq(pushSubscriptions.id, d.id));
					}
				});
				live = outcomes
					.filter(({ d }) => !gone.includes(d.id))
					.map(({ d, r }) => ({
						...d,
						...(r === 'sent' ? { failures: 0, failedAt: null } : afterFailure(d, now))
					}));
			}
		} catch (e) {
			console.error(`reminders: one person's reminders failed: ${describeError(e)}`);
		}
	}
	return sent;
}
