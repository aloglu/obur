import { describe, expect, it } from 'vitest';
import { countedActivity, parseWaterMl } from './body-types.ts';

const e = (kcal: number, kind: 'extra' | 'day_total', createdAt: string, counts = true) => ({
	kcal,
	kind,
	countsTowardBudget: counts,
	createdAt
});

describe('countedActivity', () => {
	it('adds workouts, and takes only the newest watch total of the day', () => {
		expect(
			countedActivity([
				e(300, 'day_total', '2026-10-30T09:00:00Z'),
				e(200, 'extra', '2026-10-30T10:00:00Z'),
				e(650, 'day_total', '2026-10-30T18:00:00Z'),
				e(500, 'day_total', '2026-10-30T12:00:00Z')
			])
		).toBe(850);
	});

	it('leaves out entries that do not count (imported, meaning unmapped)', () => {
		expect(
			countedActivity([e(400, 'extra', '2026-10-30T10:00:00Z', false), e(100, 'extra', 'x')])
		).toBe(100);
		expect(countedActivity([])).toBe(0);
	});
});

describe('parseWaterMl', () => {
	it('reads millilitres and litres with either decimal mark', () => {
		expect(parseWaterMl('750')).toBe(750);
		expect(parseWaterMl(' 750 ml ')).toBe(750);
		expect(parseWaterMl('3,5 l')).toBe(3500);
		expect(parseWaterMl('3.5L')).toBe(3500);
		expect(parseWaterMl('2 lt')).toBe(2000);
		expect(parseWaterMl('0,33 l')).toBe(330);
	});

	it('refuses unreadable or out-of-range amounts', () => {
		for (const bad of ['', 'l', 'two', '1.000,5', '0', '0 l', '11 l', '12000', '-250'])
			expect(parseWaterMl(bad)).toBeUndefined();
	});
});
