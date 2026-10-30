// Weight (kg) and water (ml) readings as the API returns them.
export interface BodyReading {
	id: string;
	localDate: string;
	/** Kilograms for weight, millilitres for water. */
	value: number;
	revision: number;
	createdAt: string;
}

export interface ActivityEntry {
	id: string;
	localDate: string;
	/** Calories burned above an inactive day. */
	kcal: number;
	note: string | null;
	source: 'manual' | 'loseit';
	/** Imported values with an unclear meaning are recorded but not added to the budget. */
	countsTowardBudget: boolean;
	/** extra: adds up (a workout); day_total: a watch's active calories for the day so far, the newest replaces. */
	kind: 'extra' | 'day_total';
	createdAt: string;
}

/**
 * The activity that counts toward a day's budget: every counting `extra` entry, plus the newest counting
 * `day_total` (a watch's running total replaces its earlier readings instead of adding to them).
 */
export function countedActivity(
	entries: Pick<ActivityEntry, 'kcal' | 'kind' | 'countsTowardBudget' | 'createdAt'>[]
): number {
	const counting = entries.filter((e) => e.countsTowardBudget);
	const extra = counting.filter((e) => e.kind === 'extra').reduce((sum, e) => sum + e.kcal, 0);
	const totals = counting.filter((e) => e.kind === 'day_total');
	const latest = totals.reduce<(typeof totals)[number] | undefined>(
		(a, b) => (!a || b.createdAt > a.createdAt ? b : a),
		undefined
	);
	return extra + (latest?.kcal ?? 0);
}
