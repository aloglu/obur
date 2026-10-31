import { describe, expect, it } from 'vitest';
import {
	DEFAULT_REMINDERS,
	dueReminders,
	inQuietHours,
	localTime,
	type ReminderSettings
} from './reminders.ts';

const settings = (
	times: Partial<ReminderSettings['times']>,
	extra: Partial<ReminderSettings> = {}
) => ({
	...DEFAULT_REMINDERS,
	zone: 'Europe/Istanbul',
	times: { ...DEFAULT_REMINDERS.times, ...times },
	...extra
});
// Istanbul is UTC+3 all year.
const at = (local: string, date = '2026-10-31') => new Date(`${date}T${local}:00+03:00`);

describe('quiet hours', () => {
	it('can run past midnight; the start is quiet, the end is not', () => {
		expect(inQuietHours('23:30', '22:00', '08:00')).toBe(true);
		expect(inQuietHours('07:59', '22:00', '08:00')).toBe(true);
		expect(inQuietHours('08:00', '22:00', '08:00')).toBe(false);
		expect(inQuietHours('13:00', '12:00', '14:00')).toBe(true);
		expect(inQuietHours('13:00', '09:00', '09:00')).toBe(false);
	});
});

describe('due reminders', () => {
	it('are due from their local time for an hour, in the person’s zone', () => {
		const s = settings({ lunch: '14:00', dinner: '20:30' });
		expect(localTime(at('14:05'), 'Europe/Istanbul')).toBe('14:05');
		expect(dueReminders(s, at('13:59'), new Set())).toEqual([]);
		expect(dueReminders(s, at('14:00'), new Set())).toEqual([
			{ kind: 'lunch', localDate: '2026-10-31' }
		]);
		expect(dueReminders(s, at('14:59'), new Set())).toHaveLength(1);
		// Too late: skipped rather than sent hours after the fact.
		expect(dueReminders(s, at('15:00'), new Set())).toEqual([]);
	});

	it('are sent once a day and never in quiet hours', () => {
		const s = settings({ weigh_in: '07:30', day_complete: '21:30' }, { quietStart: '21:00' });
		expect(dueReminders(s, at('07:40'), new Set())).toEqual([]); // before quiet hours end at 08:00
		expect(dueReminders(s, at('21:35'), new Set())).toEqual([]); // quiet from 21:00
		const lunch = settings({ lunch: '14:00' });
		expect(dueReminders(lunch, at('14:10'), new Set(['lunch:2026-10-31']))).toEqual([]);
		expect(
			dueReminders(lunch, at('14:10', '2026-11-01'), new Set(['lunch:2026-10-31']))
		).toHaveLength(1);
	});

	it('follow the local day, not the server’s', () => {
		const s = settings({ breakfast: '09:00' }, { zone: 'America/New_York', quietEnd: '06:00' });
		// 13:30 UTC on 31 October is 09:30 in New York (UTC−4).
		expect(dueReminders(s, new Date('2026-10-31T13:30:00Z'), new Set())).toEqual([
			{ kind: 'breakfast', localDate: '2026-10-31' }
		]);
	});

	it('are off unless a time is set', () => {
		expect(dueReminders(settings({}), at('12:00'), new Set())).toEqual([]);
	});
});
