import { describe, expect, it } from 'vitest';
import {
	achievementKey,
	achievements,
	FIRSTS,
	isAchievementKey,
	nearestKgLevel,
	nextUp,
	startWeight,
	WEIGHT_LEVELS_LB,
	type AchievementInput
} from './achievements.ts';
import { typedKg } from './weight-unit.ts';

const input = (over: Partial<AchievementInput> = {}): AchievementInput => ({
	readings: [],
	goals: [],
	completed: [],
	firsts: {},
	weightAllowed: true,
	...over
});
const r = (localDate: string, value: number) => ({ localDate, value });
const of = (list: ReturnType<typeof achievements>, kind: string) =>
	list.filter((a) => a.kind === kind).map((a) => [a.level, a.date]);

describe('weight lost', () => {
	it('awards every 2 kg the first day it is reached, never twice', () => {
		const list = achievements(
			input({
				readings: [
					r('2026-01-01', 100),
					r('2026-01-08', 98.4),
					r('2026-01-15', 98),
					// Up again, then down past 2 kg once more: no second award.
					r('2026-01-22', 98.6),
					r('2026-01-29', 97.9),
					// A big drop reaches several marks on one day.
					r('2026-02-05', 93.5)
				]
			})
		);
		expect(of(list, 'weight')).toEqual([
			[2, '2026-01-15'],
			[4, '2026-02-05'],
			[6, '2026-02-05']
		]);
	});

	it('starts from the earliest day, using a day’s last weigh-in', () => {
		const readings = [r('2026-01-01', 101), r('2026-01-01', 100), r('2026-01-02', 98.5)];
		expect(startWeight(readings)).toBe(100);
		// 98.5 is 1.5 below the start: nothing yet. A day's last reading counts, so 97.9 then 98.1 is not 2 kg.
		const list = achievements(
			input({ readings: [...readings, r('2026-01-03', 97.9), r('2026-01-03', 98.1)] })
		);
		expect(of(list, 'weight')).toEqual([]);
	});

	it('stops at 120 kg', () => {
		const list = achievements(input({ readings: [r('2025-01-01', 250), r('2026-01-01', 120)] }));
		expect(of(list, 'weight').at(-1)).toEqual([120, '2026-01-01']);
		expect(of(list, 'weight')).toHaveLength(60);
	});

	it('is off when weight celebrations do not apply', () => {
		const list = achievements(
			input({ readings: [r('2026-01-01', 100), r('2026-02-01', 90)], weightAllowed: false })
		);
		// Only the first weigh-in, which celebrates weighing, not losing.
		expect(list).toEqual([{ kind: 'first', level: 'weigh_in', date: '2026-01-01' }]);
	});

	it('withdraws an award when the weigh-in behind it is gone', () => {
		const typo = achievements(input({ readings: [r('2026-01-01', 100), r('2026-01-02', 10)] }));
		expect(of(typo, 'weight')).toHaveLength(45);
		expect(of(achievements(input({ readings: [r('2026-01-01', 100)] })), 'weight')).toEqual([]);
	});
});

describe('pounds lost', () => {
	const lb = (localDate: string, pounds: number) => r(localDate, typedKg(pounds, 'lb'));

	it('awards every 5 lb for people who use pounds, from weights typed in pounds', () => {
		const list = achievements(
			input({
				weightUnit: 'lb',
				readings: [lb('2026-01-01', 220), lb('2026-01-08', 215), lb('2026-01-15', 205.4)]
			})
		);
		expect(of(list, 'weight')).toEqual([]);
		expect(of(list, 'weight_lb')).toEqual([
			[5, '2026-01-08'],
			[10, '2026-01-15']
		]);
	});

	it('runs from 5 to 265 lb, each with the nearest kilo mark’s comparison', () => {
		expect(WEIGHT_LEVELS_LB).toHaveLength(53);
		expect(WEIGHT_LEVELS_LB.at(-1)).toBe(265);
		expect([5, 20, 35, 180, 220, 265].map(nearestKgLevel)).toEqual([2, 10, 16, 82, 100, 120]);
		// Neighbours never share a picture: each pound mark has its own kilo mark.
		expect(new Set(WEIGHT_LEVELS_LB.map(nearestKgLevel)).size).toBe(53);
	});

	it('names the next pound mark', () => {
		const list = achievements(
			input({ weightUnit: 'lb', readings: [lb('2026-01-01', 220), lb('2026-01-08', 214)] })
		);
		expect(nextUp(list, 'lb').weight).toBe(10);
	});
});

describe('goal reached', () => {
	it('counts the goal in force that day, once per goal', () => {
		const goals = [
			{ effectiveFrom: '2026-01-01', createdAt: '2026-01-01T09:00:00Z', goalWeightKg: 95 },
			{ effectiveFrom: '2026-03-01', createdAt: '2026-03-01T09:00:00Z', goalWeightKg: 90 }
		];
		const list = achievements(
			input({
				goals,
				readings: [
					r('2026-01-01', 100),
					r('2026-02-01', 94.8),
					r('2026-02-10', 96),
					r('2026-02-20', 94.9),
					r('2026-03-05', 91),
					r('2026-04-01', 90)
				]
			})
		);
		expect(of(list, 'goal')).toEqual([
			[95, '2026-02-01'],
			[90, '2026-04-01']
		]);
	});

	it('ignores a goal at or above the start weight', () => {
		const goals = [
			{ effectiveFrom: '2026-01-01', createdAt: '2026-01-01T09:00:00Z', goalWeightKg: 100 }
		];
		const list = achievements(
			input({ goals, readings: [r('2026-01-01', 100), r('2026-01-02', 99)] })
		);
		expect(of(list, 'goal')).toEqual([]);
	});
});

describe('streaks of complete days', () => {
	const run = (from: string, days: number) =>
		Array.from({ length: days }, (_, i) => {
			const [y, m, d] = from.split('-').map(Number);
			return new Date(Date.UTC(y, m - 1, d + i)).toISOString().slice(0, 10);
		});

	it('awards a length the day the run reaches it, once ever', () => {
		const list = achievements(
			input({
				// 14 in a row (across a month end), a gap, then 8 more: 3 and 7 are not awarded again.
				completed: [...run('2026-01-25', 14), ...run('2026-02-10', 8)]
			})
		);
		expect(of(list, 'streak')).toEqual([
			[3, '2026-01-27'],
			[7, '2026-01-31'],
			[14, '2026-02-07']
		]);
	});

	it('needs consecutive days', () => {
		const list = achievements(input({ completed: ['2026-01-01', '2026-01-03', '2026-01-05'] }));
		expect(of(list, 'streak')).toEqual([]);
	});
});

describe('firsts and what comes next', () => {
	it('lists firsts by date with everything else', () => {
		const list = achievements(
			input({ firsts: { recipe: '2026-03-02', scan: '2026-02-01' }, completed: [] })
		);
		expect(list).toEqual([
			{ kind: 'first', level: 'scan', date: '2026-02-01' },
			{ kind: 'first', level: 'recipe', date: '2026-03-02' }
		]);
	});

	it('names the next weight mark and streak only', () => {
		const list = achievements(
			input({ readings: [r('2026-01-01', 100), r('2026-02-01', 95)], completed: [] })
		);
		expect(nextUp(list)).toEqual({ weight: 6, streak: 3 });
		expect(nextUp([])).toEqual({ weight: 2, streak: 3 });
	});

	it('gives a new account its first steps: the first weigh-in, day logged and complete day', () => {
		const list = achievements(
			input({
				readings: [r('2026-01-03', 90), r('2026-01-05', 89.6)],
				completed: ['2026-01-04', '2026-01-02'],
				firsts: { day_logged: '2026-01-01' },
				weightAllowed: false
			})
		);
		expect(of(list, 'first')).toEqual([
			['day_logged', '2026-01-01'],
			['complete_day', '2026-01-02'],
			['weigh_in', '2026-01-03']
		]);
		// Withdrawn with the records behind them.
		expect(of(achievements(input({ weightAllowed: false })), 'first')).toEqual([]);
	});
});

describe('isAchievementKey', () => {
	it('takes every key the app makes', () => {
		for (const first of FIRSTS)
			expect(isAchievementKey(achievementKey({ kind: 'first', level: first }))).toBe(true);
		for (const level of WEIGHT_LEVELS_LB)
			expect(isAchievementKey(achievementKey({ kind: 'weight_lb', level }))).toBe(true);
		expect(isAchievementKey('weight:120')).toBe(true);
		expect(isAchievementKey('goal:72.5')).toBe(true);
		expect(isAchievementKey('streak:365')).toBe(true);
	});

	it('refuses anything else', () => {
		for (const key of [
			'first:other',
			'weight:',
			'weight:1000',
			'streak:1.5',
			'badge:2',
			'weight_lb:5;'
		])
			expect(isAchievementKey(key)).toBe(false);
	});
});
