import { describe, expect, it } from 'vitest';
import type { TargetLike } from './calendar.ts';
import {
	history,
	isHistoryRange,
	rangeStart,
	weightTrend,
	type HistoryDay,
	type HistoryInput
} from './history.ts';

const manual = (effectiveFrom: string, budget: number): TargetLike => ({
	effectiveFrom,
	createdAt: '2026-01-01T00:00:00Z',
	mode: 'manual',
	baseBurnKcal: budget,
	deficitKcal: 0,
	floorKcal: 0
});
const known = (value: number) => ({ value, missing: 0 });
const day = (date: string, eatenKcal: number, extra: Partial<HistoryDay> = {}): HistoryDay => ({
	date,
	eatenKcal,
	complete: true,
	protein: known(100),
	carbohydrate: known(200),
	fat: known(60),
	...extra
});
const input = (extra: Partial<HistoryInput>): HistoryInput => ({
	from: '2026-10-05',
	to: '2026-10-11',
	days: [],
	versions: [manual('2026-01-01', 2000)],
	activity: new Map(),
	water: new Map(),
	weighIns: 0,
	firstDayOfWeek: 1,
	...extra
});

describe('ranges', () => {
	it('counts back from today, including today', () => {
		expect(rangeStart('1W', '2026-10-31', null)).toBe('2026-10-25');
		expect(rangeStart('1M', '2026-10-31', null)).toBe('2026-10-01');
		expect(rangeStart('1M', '2026-03-31', null)).toBe('2026-03-01');
		expect(rangeStart('1M', '2026-03-15', null)).toBe('2026-02-16');
		expect(rangeStart('3M', '2026-01-10', null)).toBe('2025-10-11');
		expect(rangeStart('3M', '2026-10-31', null)).toBe('2026-08-01');
		expect(rangeStart('1Y', '2026-10-31', null)).toBe('2025-11-01');
	});

	it('starts All at the first record, or today when there is none', () => {
		expect(rangeStart('All', '2026-10-31', '2025-08-01')).toBe('2025-08-01');
		expect(rangeStart('All', '2026-10-31', null)).toBe('2026-10-31');
		expect(isHistoryRange('3M')).toBe(true);
		expect(isHistoryRange('2W')).toBe(false);
		expect(isHistoryRange(null)).toBe(false);
	});
});

describe('weight trend', () => {
	it('moves 10 % toward a reading per day elapsed and invents no readings in gaps', () => {
		const points = weightTrend([
			{ localDate: '2026-10-01', value: 100 },
			{ localDate: '2026-10-02', value: 99 },
			// Ten days later: the reading counts for 1 − 0.9¹⁰ ≈ 65 % and the stretch before it is a gap.
			{ localDate: '2026-10-12', value: 97 }
		]);
		expect(points.map((p) => p.date)).toEqual(['2026-10-01', '2026-10-02', '2026-10-12']);
		expect(points[0]).toMatchObject({ trend: 100, gapBefore: false });
		expect(points[1]).toMatchObject({ trend: 99.9, gapBefore: false });
		expect(points[2].trend).toBeCloseTo(99.9 - 0.6513 * 2.9, 2);
		expect(points[2].gapBefore).toBe(true);
	});

	it('uses the last reading of a day and accepts readings in any order', () => {
		const points = weightTrend([
			{ localDate: '2026-10-02', value: 98 },
			{ localDate: '2026-10-01', value: 100 },
			{ localDate: '2026-10-02', value: 99 }
		]);
		expect(points).toHaveLength(2);
		expect(points[1]).toMatchObject({ weight: 99, trend: 99.9 });
	});

	it('keeps a single high reading from moving the trend much', () => {
		const steady = Array.from({ length: 10 }, (_, i) => ({
			localDate: `2026-10-${String(i + 1).padStart(2, '0')}`,
			value: 98
		}));
		const points = weightTrend([...steady, { localDate: '2026-10-11', value: 99.4 }]);
		expect(points.at(-1)!.trend).toBeCloseTo(98.14, 2);
	});
});

describe('calorie bars', () => {
	it('gives a bar per day up to a month, with each day against its own budget', () => {
		const { bars, weekly } = history(
			input({
				versions: [manual('2026-01-01', 2000), manual('2026-10-08', 1900)],
				activity: new Map([['2026-10-09', 300]]),
				days: [
					day('2026-10-05', 1800),
					day('2026-10-08', 1950, { complete: false }),
					day('2026-10-09', 2100)
				]
			})
		);
		expect(weekly).toBe(false);
		expect(bars).toHaveLength(7);
		expect(bars[0]).toMatchObject({ eatenKcal: 1800, budgetKcal: 2000, complete: true });
		// Unlogged: no value, not zero.
		expect(bars[1]).toMatchObject({ eatenKcal: null, loggedDays: 0, complete: false });
		expect(bars[3]).toMatchObject({ eatenKcal: 1950, budgetKcal: 1900, complete: false });
		// Counted activity raises that day's budget.
		expect(bars[4]).toMatchObject({ eatenKcal: 2100, budgetKcal: 2200 });
	});

	it('averages logged days per week beyond a month, weeks starting on the chosen day', () => {
		const days = [day('2026-09-07', 1800), day('2026-09-08', 2000), day('2026-10-05', 2100)];
		const monday = history(input({ from: '2026-09-07', to: '2026-10-11', days }));
		expect(monday.weekly).toBe(true);
		expect(monday.bars).toHaveLength(5);
		expect(monday.bars[0]).toMatchObject({
			from: '2026-09-07',
			to: '2026-09-13',
			eatenKcal: 1900,
			budgetKcal: 2000,
			loggedDays: 2,
			days: 7
		});
		expect(monday.bars[1].eatenKcal).toBeNull();
		const sunday = history(
			input({ from: '2026-09-07', to: '2026-10-11', days, firstDayOfWeek: 7 })
		);
		expect(sunday.bars[0]).toMatchObject({ from: '2026-09-07', to: '2026-09-12' });
	});

	it('has no budget for days without a target', () => {
		const { bars } = history(input({ versions: [], days: [day('2026-10-05', 1800)] }));
		expect(bars[0]).toMatchObject({ eatenKcal: 1800, budgetKcal: null });
	});
});

describe('averages', () => {
	it('count only complete days and say how many', () => {
		const { averages } = history(
			input({
				days: [
					day('2026-10-05', 1800),
					day('2026-10-06', 2300),
					// Not marked complete: left out, however low.
					day('2026-10-07', 900, { complete: false })
				]
			})
		);
		expect(averages.completeDays).toBe(2);
		expect(averages.eatenKcal).toEqual({ value: 2050, days: 2 });
		expect(averages.againstBudget).toEqual({ value: 50, days: 2 });
		expect(averages.overBudgetDays).toBe(1);
	});

	it('average a nutrient only over days where every entry states it', () => {
		const { averages } = history(
			input({
				days: [
					day('2026-10-05', 1800, { carbohydrate: known(180) }),
					day('2026-10-06', 1900, { carbohydrate: { value: 90, missing: 2 } }),
					day('2026-10-07', 2000, { protein: { value: 40, missing: 1 } })
				]
			})
		);
		expect(averages.carbohydrate).toEqual({ value: 190, days: 2 });
		expect(averages.protein).toEqual({ value: 100, days: 2 });
		expect(averages.fat).toEqual({ value: 60, days: 3 });
	});

	it('average water over days with water, and leave averages empty without data', () => {
		const { averages } = history(
			input({
				water: new Map([
					['2026-10-05', 2000],
					['2026-10-06', 3000],
					['2026-09-30', 9000]
				]),
				weighIns: 4
			})
		);
		expect(averages.waterMl).toEqual({ value: 2500, days: 2 });
		expect(averages.eatenKcal).toEqual({ value: null, days: 0 });
		expect(averages.weighIns).toBe(4);
	});
});
