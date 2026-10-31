// Reminders (docs/design.md, "Reminders"; owner's choices 2026-10-31): per person, opt-in, each at a chosen local
// time, sent only when what it reminds about is still missing, never in quiet hours, at most once a day each.
// This file decides which reminders are due; whether each is still needed is checked against the diary afterwards.
import * as v from 'valibot';
import { isValidZone, localDate } from './diary-rules.ts';

export const REMINDER_KINDS = ['breakfast', 'lunch', 'dinner', 'weigh_in', 'day_complete'] as const;
export type ReminderKind = (typeof REMINDER_KINDS)[number];

/** A reminder is still sent this long after its time (a worker that was briefly down catches up); later, it's skipped. */
export const SEND_WINDOW_MIN = 60;

export interface ReminderSettings {
	/** The person's time zone when they last saved the settings. */
	zone: string;
	/** "HH:MM" local time per reminder, or null when off. */
	times: Record<ReminderKind, string | null>;
	/** Quiet hours, "HH:MM"; may run past midnight (22:00 to 08:00). */
	quietStart: string;
	quietEnd: string;
}

export const DEFAULT_REMINDERS: ReminderSettings = {
	zone: 'UTC',
	times: { breakfast: null, lunch: null, dinner: null, weigh_in: null, day_complete: null },
	quietStart: '22:00',
	quietEnd: '08:00'
};

const Time = v.pipe(v.string(), v.regex(/^([01]\d|2[0-3]):[0-5]\d$/));
export const ReminderSettingsInput = v.object({
	zone: v.pipe(v.string(), v.maxLength(64), v.check(isValidZone, 'Invalid time zone')),
	times: v.object(
		Object.fromEntries(REMINDER_KINDS.map((k) => [k, v.nullable(Time)])) as Record<
			ReminderKind,
			v.NullableSchema<typeof Time, undefined>
		>
	),
	quietStart: Time,
	quietEnd: Time
});

const minutes = (hhmm: string) => Number(hhmm.slice(0, 2)) * 60 + Number(hhmm.slice(3, 5));

/** The local "HH:MM" of an instant in a zone. */
export function localTime(instant: Date, zone: string): string {
	return new Intl.DateTimeFormat('en-GB', {
		timeZone: zone,
		hour: '2-digit',
		minute: '2-digit',
		hourCycle: 'h23'
	}).format(instant);
}

/** Whether a local time falls in quiet hours (the start is quiet, the end is not). */
export function inQuietHours(time: string, start: string, end: string): boolean {
	const [t, s, e] = [minutes(time), minutes(start), minutes(end)];
	if (s === e) return false;
	return s < e ? t >= s && t < e : t >= s || t < e;
}

/**
 * The reminders due at `now` for one person: switched on, within the send window after their time, outside quiet
 * hours and not yet sent today (`sent` holds "kind:YYYY-MM-DD" keys). Each comes with the local day it is for.
 */
export function dueReminders(
	settings: ReminderSettings,
	now: Date,
	sent: ReadonlySet<string>
): { kind: ReminderKind; localDate: string }[] {
	const date = localDate(now, settings.zone);
	const time = localTime(now, settings.zone);
	if (inQuietHours(time, settings.quietStart, settings.quietEnd)) return [];
	const t = minutes(time);
	return REMINDER_KINDS.flatMap((kind) => {
		const at = settings.times[kind];
		if (!at || sent.has(`${kind}:${date}`)) return [];
		const since = t - minutes(at);
		return since >= 0 && since < SEND_WINDOW_MIN ? [{ kind, localDate: date }] : [];
	});
}
