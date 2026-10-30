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

/**
 * A typed water amount in millilitres: "750", "750 ml", "3,5 l" or "3.5L" (comma or dot decimals). A bare number is in
 * `unit`, the field's chosen suffix. Undefined when unreadable or outside 1 ml–10 l (the database range).
 */
export function parseWaterMl(input: string, unit: 'ml' | 'l' = 'ml'): number | undefined {
	const match = /^\s*(\d+(?:[.,]\d+)?|[.,]\d+)\s*(ml|l|lt|litre|liter)?\s*$/i.exec(input);
	if (!match) return undefined;
	const value = Number(match[1].replace(',', '.'));
	const litres = match[2] ? match[2].toLowerCase() !== 'ml' : unit === 'l';
	const ml = Math.round(litres ? value * 1000 : value);
	return ml >= 1 && ml <= 10_000 ? ml : undefined;
}
