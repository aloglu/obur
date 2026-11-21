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

/** The zone's offset from UTC at an instant, in minutes (Istanbul: 180). */
function offsetMinutes(instant: Date, zone: string): number {
	const parts = Object.fromEntries(
		new Intl.DateTimeFormat('en-GB', {
			timeZone: zone,
			year: 'numeric',
			month: '2-digit',
			day: '2-digit',
			hour: '2-digit',
			minute: '2-digit',
			hourCycle: 'h23'
		})
			.formatToParts(instant)
			.map((p) => [p.type, p.value])
	);
	const wall = Date.UTC(+parts.year, +parts.month - 1, +parts.day, +parts.hour, +parts.minute);
	return Math.round((wall - Math.floor(instant.getTime() / 60_000) * 60_000) / 60_000);
}

/**
 * The instant a local day's "HH:MM" happens in a zone. A time the clocks skip (spring forward) moves forward by the
 * jump, so a 02:00 reminder on that day comes at 03:00; a time that happens twice (fall back) counts the first
 * (2026-11-21 audit, A26).
 */
export function zonedInstant(localDay: string, hhmm: string, zone: string): Date {
	const wall = Date.UTC(
		+localDay.slice(0, 4),
		+localDay.slice(5, 7) - 1,
		+localDay.slice(8, 10),
		+hhmm.slice(0, 2),
		+hhmm.slice(3, 5)
	);
	// First with the offset the day before: right on an ordinary day, and the first of two on a fall-back day.
	const before = offsetMinutes(new Date(wall - 24 * 3600_000), zone);
	const guess = new Date(wall - before * 60_000);
	const after = offsetMinutes(guess, zone);
	if (after === before) return guess;
	// The offset changed before this time: the time with the new offset, unless the clocks skipped it, when the guess
	// (with the old offset) is the moment the same distance past the jump.
	const second = new Date(wall - after * 60_000);
	return offsetMinutes(second, zone) === after ? second : guess;
}

/**
 * The reminders due at `now` for one person: switched on, within the send window after their time (real minutes,
 * so a time in the hour the clocks skip still comes), outside quiet hours and not yet sent today (`sent` holds
 * "kind:YYYY-MM-DD" keys). Each comes with the local day it is for.
 */
export function dueReminders(
	settings: ReminderSettings,
	now: Date,
	sent: ReadonlySet<string>
): { kind: ReminderKind; localDate: string }[] {
	const date = localDate(now, settings.zone);
	const time = localTime(now, settings.zone);
	if (inQuietHours(time, settings.quietStart, settings.quietEnd)) return [];
	return REMINDER_KINDS.flatMap((kind) => {
		const at = settings.times[kind];
		if (!at || sent.has(`${kind}:${date}`)) return [];
		const since = (now.getTime() - zonedInstant(date, at, settings.zone).getTime()) / 60_000;
		return since >= 0 && since < SEND_WINDOW_MIN ? [{ kind, localDate: date }] : [];
	});
}
