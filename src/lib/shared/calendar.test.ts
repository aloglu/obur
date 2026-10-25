import { describe, expect, it } from 'vitest';
import {
	calendarDays,
	isoWeekday,
	monthDays,
	monthSummary,
	monthWeeks,
	shiftMonth,
	targetOn,
	type TargetLike
} from './calendar.ts';

const version = (
	effectiveFrom: string,
	budget: number,
	createdAt = '2026-01-01T00:00:00Z'
): TargetLike => ({
	effectiveFrom,
	createdAt,
	mode: 'manual',
	baseBurnKcal: budget,
	deficitKcal: 0,
	floorKcal: 0
});

describe('month layout', () => {
	it('lists the days of months of any length', () => {
		expect(monthDays('2026-10')).toHaveLength(31);
		expect(monthDays('2026-02')).toHaveLength(28);
		expect(monthDays('2028-02').at(-1)).toBe('2028-02-29');
	});

	it('starts weeks on Monday by default, or on Sunday', () => {
		expect(isoWeekday('2026-10-01')).toBe(4); // Thursday
		const weeks = monthWeeks('2026-10');
		expect(weeks[0]).toEqual([
			null,
			null,
			null,
			'2026-10-01',
			'2026-10-02',
			'2026-10-03',
			'2026-10-04'
		]);
		expect(weeks.every((w) => w.length === 7)).toBe(true);
		expect(monthWeeks('2026-10', 7)[0].slice(0, 5)).toEqual([null, null, null, null, '2026-10-01']);
	});

	it('moves between months across years', () => {
		expect(shiftMonth('2026-01', -1)).toBe('2025-12');
		expect(shiftMonth('2026-12', 1)).toBe('2027-01');
	});
});

describe('targetOn', () => {
	it('uses the newest version effective on or before the day', () => {
		const versions = [
			version('2026-10-10', 1800),
			version('2026-10-01', 2000),
			version('2026-10-01', 2100, '2026-10-05T00:00:00Z')
		];
		expect(targetOn(versions, '2026-09-30')).toBeNull();
		expect(targetOn(versions, '2026-10-05')?.baseBurnKcal).toBe(2100);
		expect(targetOn(versions, '2026-10-10')?.baseBurnKcal).toBe(1800);
	});
});

describe('calendarDays', () => {
	const data = {
		eaten: new Map([
			['2026-10-01', 1800],
			['2026-10-02', 2400],
			['2026-10-03', 1500],
			['2026-10-04', 900],
			['2026-10-05', 1000]
		]),
		activity: new Map([['2026-10-03', 600]]),
		completed: new Set(['2026-10-01', '2026-10-03']),
		versions: [version('2026-10-01', 2000)]
	};
	const days = calendarDays('2026-10', '2026-10-05', data);
	const day = (d: string) => days.find((x) => x.date === d)!;

	it('is green only for complete days at or under budget', () => {
		expect(day('2026-10-01')).toMatchObject({ status: 'under', fill: 0.9 });
		expect(day('2026-10-04')).toMatchObject({ status: 'incomplete', fill: 0.45 });
	});

	it('shows over-budget days as a full red ring, complete or not', () => {
		expect(day('2026-10-02')).toMatchObject({ status: 'over', fill: 1 });
	});

	it('adds counted activity to that day’s budget', () => {
		expect(day('2026-10-03')).toMatchObject({ status: 'under', budgetKcal: 2600 });
	});

	it('keeps missing days unlogged and future days without a ring', () => {
		expect(day('2026-10-05').isToday).toBe(true);
		expect(day('2026-10-06').status).toBe('future');
		const early = calendarDays('2026-10', '2026-10-31', data);
		expect(early.find((d) => d.date === '2026-10-20')).toMatchObject({
			status: 'unlogged',
			eatenKcal: 0
		});
	});

	it('marks logged days without a budget separately', () => {
		const none = calendarDays('2026-10', '2026-10-05', { ...data, versions: [] });
		expect(none.find((d) => d.date === '2026-10-01')?.status).toBe('no_budget');
	});

	it('summarises past days only', () => {
		expect(monthSummary(days)).toEqual({ under: 2, over: 1, incomplete: 1, unlogged: 0 });
	});
});
