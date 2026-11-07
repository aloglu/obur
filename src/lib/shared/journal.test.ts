import { describe, expect, it } from 'vitest';
import { calendarDays, type TargetLike } from './calendar.ts';
import { journal, type JournalInput } from './journal.ts';

const manual = (effectiveFrom: string, kcal: number, createdAt = effectiveFrom): TargetLike => ({
	effectiveFrom,
	createdAt,
	mode: 'manual',
	baseBurnKcal: kcal,
	deficitKcal: 0,
	floorKcal: 0
});

function input(
	over: Partial<JournalInput> & { eaten?: Record<string, number> } = {}
): JournalInput {
	const month = over.month ?? '2026-10';
	const today = over.today ?? '2026-10-31';
	const versions = over.versions ?? [manual('2026-09-01', 2000)];
	const completed = over.completed ?? new Set<string>();
	const days = calendarDays(month, today, {
		eaten: new Map(Object.entries(over.eaten ?? {})),
		activity: new Map(),
		completed,
		versions
	});
	return {
		month,
		today,
		firstDayOfWeek: 1,
		days,
		completed,
		readings: [],
		versions,
		...over
	};
}

describe('journal weeks', () => {
	it('cuts weeks at the month edges and today, newest first, leaving out empty weeks', () => {
		// October 2026 starts on a Thursday; today is Wednesday 14 October.
		const weeks = journal(
			input({
				today: '2026-10-14',
				eaten: { '2026-10-02': 1800, '2026-10-06': 1900, '2026-10-13': 2100 }
			})
		);
		expect(weeks.map((w) => [w.from, w.to, w.current])).toEqual([
			['2026-10-12', '2026-10-14', true],
			['2026-10-05', '2026-10-11', false],
			['2026-10-01', '2026-10-04', false]
		]);
	});

	it('starts weeks on the chosen day', () => {
		const weeks = journal(
			input({ firstDayOfWeek: 7, eaten: { '2026-10-03': 1800, '2026-10-04': 1800 } })
		);
		expect(weeks.at(-1)).toMatchObject({ from: '2026-10-01', to: '2026-10-03' });
		expect(weeks.at(-2)).toMatchObject({ from: '2026-10-04', to: '2026-10-10' });
	});

	it('averages only complete days, against each day’s budget', () => {
		const [week] = journal(
			input({
				today: '2026-10-07',
				versions: [manual('2026-09-01', 2000), manual('2026-10-07', 1800)],
				eaten: { '2026-10-05': 1700, '2026-10-06': 2300, '2026-10-07': 1500 },
				// Not complete, however low: 7 October is left out of the averages.
				completed: new Set(['2026-10-05', '2026-10-06'])
			})
		);
		expect(week).toMatchObject({ completeDays: 2, averageKcal: 2000, averageDiff: 0 });
	});

	it('has no averages without a complete day', () => {
		const [week] = journal(input({ today: '2026-10-07', eaten: { '2026-10-06': 900 } }));
		expect(week).toMatchObject({ completeDays: 0, averageKcal: null, averageDiff: null });
	});

	it('gives the change from the last weigh-in before the week to the week’s last', () => {
		const weeks = journal(
			input({
				today: '2026-10-14',
				readings: [
					{ localDate: '2026-09-28', value: 90.4 },
					{ localDate: '2026-10-06', value: 89.9 },
					{ localDate: '2026-10-08', value: 89.5 },
					// A day's last reading counts.
					{ localDate: '2026-10-08', value: 89.6 },
					{ localDate: '2026-10-13', value: 89.8 }
				]
			})
		);
		// 1–4 October recorded nothing, so it is left out.
		expect(weeks.map((w) => w.weightChange)).toEqual([0.2, -0.8]);
	});
});

describe('journal highlights', () => {
	it('marks the week’s lowest weigh-in when it beats every earlier one, once a week', () => {
		const weeks = journal(
			input({
				today: '2026-10-21',
				readings: [
					{ localDate: '2026-08-01', value: 88.0 },
					{ localDate: '2026-10-06', value: 88.4 },
					{ localDate: '2026-10-13', value: 87.9 },
					{ localDate: '2026-10-14', value: 87.6 },
					{ localDate: '2026-10-16', value: 87.8 },
					{ localDate: '2026-10-20', value: 87.7 }
				]
			})
		);
		const lows = weeks.flatMap((w) => w.events.filter((e) => e.kind === 'lowest'));
		expect(lows).toEqual([{ kind: 'lowest', date: '2026-10-14', kg: 87.6 }]);
	});

	it('never calls the very first weigh-in a new lowest', () => {
		const weeks = journal(
			input({ today: '2026-10-14', readings: [{ localDate: '2026-10-06', value: 90 }] })
		);
		expect(weeks.flatMap((w) => w.events)).toEqual([]);
	});

	it('shows a budget change once a week, from before the week to its end', () => {
		const weeks = journal(
			input({
				today: '2026-10-21',
				versions: [
					manual('2026-09-01', 2000),
					manual('2026-10-06', 1900),
					manual('2026-10-08', 1850),
					// A new version with the same budget is not a change.
					manual('2026-10-14', 1850)
				],
				eaten: { '2026-10-15': 1800 }
			})
		);
		const changes = weeks.flatMap((w) => w.events.filter((e) => e.kind === 'budget'));
		expect(changes).toEqual([{ kind: 'budget', date: '2026-10-08', from: 2000, to: 1850 }]);
	});

	it('orders a week’s highlights newest first, achievements first on the same day', () => {
		const firstDay = { kind: 'first', level: 'day_logged', date: '2026-10-06' } as const;
		const [week] = journal(
			input({
				today: '2026-10-07',
				versions: [manual('2026-10-06', 2000)],
				eaten: { '2026-10-05': 1800 },
				achievements: [firstDay]
			})
		);
		// The first day logged is an achievement now, not a highlight of its own.
		expect(week.events).toEqual([
			{ kind: 'achievement', date: '2026-10-06', achievement: firstDay },
			{ kind: 'budget', date: '2026-10-06', from: null, to: 2000 }
		]);
	});

	it('is empty for a month with nothing recorded', () => {
		expect(journal(input({ month: '2026-08', today: '2026-10-31', versions: [] }))).toEqual([]);
	});
});

describe('journal achievements', () => {
	it('puts an achievement in its week, ahead of other highlights that day', () => {
		const [week] = journal(
			input({
				today: '2026-10-07',
				eaten: { '2026-10-06': 1800 },
				readings: [
					{ localDate: '2026-09-01', value: 90 },
					{ localDate: '2026-10-06', value: 88 }
				],
				achievements: [
					{ kind: 'weight', level: 2, date: '2026-10-06' },
					{ kind: 'streak', level: 7, date: '2026-09-30' }
				]
			})
		);
		expect(week.events.map((e) => e.kind)).toEqual(['achievement', 'lowest']);
	});
});
