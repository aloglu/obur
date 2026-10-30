// What an edit through the food form keeps from the food as it was. The form shows only the label's core rows, so
// other source values (minerals, fat types, starch …) are carried over untouched, as long as the basis stays the
// same: after a basis change they would describe a different amount, so they become unknown. Derived values are
// always recomputed on the server. A portion keeps its source while its name, size and unit are unchanged.
import type { NutrientCode, NutrientValue } from './nutrients.ts';

/** Every code the form can write. */
export const FORM_CODES: ReadonlySet<NutrientCode> = new Set<NutrientCode>([
	'energy_kcal',
	'energy_kj',
	'fat',
	'saturated_fat',
	'carbohydrate_excl_fibre',
	'carbohydrate_total',
	'sugars',
	'fibre',
	'protein',
	'salt',
	'sodium'
]);

export function preservedNutrients(initial: NutrientValue[], sameBasis: boolean): NutrientValue[] {
	if (!sameBasis) return [];
	return initial.filter((n) => !FORM_CODES.has(n.code) && n.qualifier !== 'derived');
}

type Source = 'label' | 'user' | 'estimate' | 'reference';
export function portionSource(
	initial: { name: string; amount: number; unit: 'g' | 'ml'; source?: Source }[],
	portion: { name: string; amount: number; unit: 'g' | 'ml' }
): Source {
	const same = initial.find(
		(s) =>
			s.name.trim() === portion.name.trim() &&
			s.amount === portion.amount &&
			s.unit === portion.unit
	);
	return same?.source ?? 'user';
}
