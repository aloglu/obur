// Plausibility checks for nutrition values (docs/design.md, "OCR and barcode capture"). They produce warnings for
// the person to review; they never change values, and failing one never blocks saving a legitimate food.
import type { NutrientCode, NutrientValue } from './nutrients.ts';
import type { Basis } from './quantity.ts';

export type FoodWarning =
	| 'sugars_exceed_carbohydrate'
	| 'saturated_exceeds_fat'
	| 'mass_exceeds_100'
	| 'energy_units_mismatch'
	| 'energy_macros_mismatch'
	| 'salt_sodium_mismatch'
	| 'energy_missing';

/** EU energy factors (Regulation 1169/2011, Annex XIV), kcal per gram. */
const KCAL_PER_G: Partial<Record<NutrientCode, number>> = {
	fat: 9,
	carbohydrate_excl_fibre: 4,
	protein: 4,
	fibre: 2,
	polyols: 2.4
};

export function foodWarnings(basis: Basis, values: NutrientValue[]): FoodWarning[] {
	const exact = new Map(
		values.filter((v) => v.qualifier !== 'less_than').map((v) => [v.code, v.value])
	);
	const any = new Map(values.map((v) => [v.code, v.value]));
	const warnings: FoodWarning[] = [];
	const has = (c: NutrientCode) => exact.has(c);
	const val = (c: NutrientCode) => exact.get(c) ?? 0;

	if (!any.has('energy_kcal') && !any.has('energy_kj')) warnings.push('energy_missing');
	if (
		has('sugars') &&
		has('carbohydrate_excl_fibre') &&
		val('sugars') > val('carbohydrate_excl_fibre') + 0.1
	) {
		warnings.push('sugars_exceed_carbohydrate');
	}
	if (has('saturated_fat') && has('fat') && val('saturated_fat') > val('fat') + 0.1) {
		warnings.push('saturated_exceeds_fat');
	}
	if (basis === '100g') {
		const mass = (['fat', 'carbohydrate_excl_fibre', 'protein', 'fibre', 'salt'] as const).reduce(
			(sum, c) => sum + val(c),
			0
		);
		if (mass > 102) warnings.push('mass_exceeds_100');
	}
	if (has('energy_kcal') && has('energy_kj')) {
		const expectedKcal = val('energy_kj') / 4.184;
		if (Math.abs(expectedKcal - val('energy_kcal')) > Math.max(2, expectedKcal * 0.05)) {
			warnings.push('energy_units_mismatch');
		}
	}
	// Only when every main contributor is known; rounded labels legitimately differ, so the margin is generous. A
	// "less than" value counts at its bound: it is small, and skipping the check would hide a misread elsewhere.
	const known = (c: NutrientCode) => any.has(c);
	if (has('energy_kcal') && known('fat') && known('carbohydrate_excl_fibre') && known('protein')) {
		const computed = Object.entries(KCAL_PER_G).reduce(
			(sum, [c, f]) => sum + (any.get(c as NutrientCode) ?? 0) * (f ?? 0),
			0
		);
		const reported = val('energy_kcal');
		if (Math.abs(computed - reported) > Math.max(15, reported * 0.2)) {
			warnings.push('energy_macros_mismatch');
		}
	}
	if (has('salt') && has('sodium')) {
		const expected = (val('sodium') * 2.5) / 1000;
		if (Math.abs(expected - val('salt')) > Math.max(0.1, expected * 0.1))
			warnings.push('salt_sodium_mismatch');
	}
	return warnings;
}
