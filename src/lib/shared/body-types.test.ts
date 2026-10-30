import { describe, expect, it } from 'vitest';
import { countedActivity } from './body-types.ts';

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
