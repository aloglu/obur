// Recipes (docs/design.md, "Food catalog and recipes"): types, input and the pure arithmetic. A recipe is a food
// per serving: the sum of its ingredients' pinned values divided by the number of servings. Per-gram values exist
// only when the finished dish's weight is given; it is never inferred from the raw ingredients.
import * as v from 'valibot';
import { UnitInput } from './diary-input.ts';
import { isFoodIcon } from './food-icons.ts';
import type { EntryNutrients, FoodSnapshot, SnapshotUnit } from './diary-types.ts';
import { NUTRIENT_CODES, type NutrientValue, type Qualifier } from './nutrients.ts';

export interface RecipeIngredient {
	id: string;
	/** The food it was taken from, while it exists and is visible. */
	foodId: string | null;
	food: FoodSnapshot;
	amount: number;
	unit: SnapshotUnit;
	nutrients: EntryNutrients;
}

export interface Recipe {
	/** The recipe's food. */
	id: string;
	name: string;
	visibility: 'private' | 'shared';
	/** The chosen icon; null shows the name's suggestion. */
	icon: string | null;
	version: number;
	servings: number;
	cookedYieldG: number | null;
	archived: boolean;
	ingredients: RecipeIngredient[];
}

export interface RecipeSummary {
	id: string;
	name: string;
	icon: string | null;
	visibility: 'private' | 'shared';
	servings: number;
	/** Energy per serving; null when an ingredient doesn't state it. */
	kcal: number | null;
	archived: boolean;
}

/** The label of a recipe's one serving (its basis). */
export const RECIPE_SERVING_LABEL = 'serving';

const Uuid = v.pipe(v.string(), v.uuid());
const Amount = v.pipe(v.number(), v.finite(), v.gtValue(0), v.maxValue(100_000));

/**
 * The editor's save. `version` null creates the recipe (idempotent by `id`); a number replaces it if unchanged
 * since. Ingredients in order: kept ones by ID (with a new amount or unit), or new foods.
 */
export const SaveRecipe = v.object({
	version: v.nullable(v.pipe(v.number(), v.integer(), v.minValue(1))),
	name: v.pipe(
		v.string(),
		v.transform((s) => s.normalize('NFC').replace(/\s+/g, ' ').trim()),
		v.minLength(1),
		v.maxLength(200)
	),
	visibility: v.picklist(['private', 'shared']),
	// Absent or null: no chosen icon (the name's suggestion shows).
	icon: v.optional(v.nullable(v.pipe(v.string(), v.check(isFoodIcon, 'Unknown icon'))), null),
	servings: v.pipe(v.number(), v.finite(), v.gtValue(0), v.maxValue(1000)),
	cookedYieldG: v.nullable(v.pipe(v.number(), v.finite(), v.gtValue(0), v.maxValue(100_000))),
	ingredients: v.pipe(
		v.array(
			v.union([
				v.object({ ingredientId: Uuid, amount: v.optional(Amount), unit: v.optional(UnitInput) }),
				v.object({ foodId: Uuid, amount: Amount, unit: UnitInput })
			])
		),
		v.minLength(1),
		v.maxLength(100)
	)
});
export type SaveRecipe = v.InferOutput<typeof SaveRecipe>;

const round = (n: number) => Math.round(n * 10_000) / 10_000;

/**
 * The recipe's values per serving. A nutrient is known only when every ingredient states it (unknown is never
 * zero); the result is `derived` from exact values, or an `estimate` when any part is an estimate or an upper bound.
 */
export function recipeNutrients(ingredients: EntryNutrients[], servings: number): NutrientValue[] {
	if (ingredients.length === 0 || servings <= 0) return [];
	const out: NutrientValue[] = [];
	for (const code of NUTRIENT_CODES) {
		const parts = ingredients.map((n) => n[code]);
		if (parts.some((p) => p === undefined)) continue;
		const sum = parts.reduce((total, p) => total + p!.value, 0);
		const exact = parts.every((p) => p!.qualifier === 'reported' || p!.qualifier === 'derived');
		const qualifier: Qualifier = exact ? 'derived' : 'estimate';
		out.push({ code, value: round(sum / servings), qualifier });
	}
	return out;
}
