// What an edit through the food form keeps from the food as it was. The form shows the label's core rows, and the
// source-backed extra rows (minerals, fat types, starch …) under "More nutrients". Values the form doesn't show — an
// extra value that is an estimate, say — are carried over untouched unless a new value is entered for that nutrient,
// as long as the basis stays the same: after a basis change they would describe a different amount, so they become
// unknown. Derived values are always recomputed on the server. A portion keeps its source while its name, size and
// unit are unchanged.
import type { NutrientCode, NutrientValue } from './nutrients.ts';
import { formatDecimal, parseDecimal } from './numbers.ts';

/** The label's core rows: every code they can write. */
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

/** The optional "More nutrients" rows, in form order. They show reported and "less than" values. */
export const EXTRA_CODES = [
	'monounsaturated_fat',
	'polyunsaturated_fat',
	'trans_fat',
	'cholesterol',
	'starch',
	'polyols',
	'calcium',
	'potassium',
	'iron'
] as const satisfies readonly NutrientCode[];

const shownByForm = (n: NutrientValue) =>
	FORM_CODES.has(n.code) ||
	((EXTRA_CODES as readonly NutrientCode[]).includes(n.code) &&
		(n.qualifier === 'reported' || n.qualifier === 'less_than'));

export function preservedNutrients(
	initial: NutrientValue[],
	sameBasis: boolean,
	entered: readonly NutrientCode[] = []
): NutrientValue[] {
	if (!sameBasis) return [];
	return initial.filter(
		(n) => !shownByForm(n) && n.qualifier !== 'derived' && !entered.includes(n.code)
	);
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

/**
 * A label value as typed in a form field. A leading "<" marks a value printed as "less than" ("<0.5"): Scan fills it
 * in that way and a person may type it, with no separate control (owner, 2026-11-18). Undefined when the rest isn't
 * a number; empty input is also undefined (unknown, not zero).
 */
export function parseLabelValue(input: string): { value: number; lessThan: boolean } | undefined {
	const s = input.trim();
	const lessThan = s.startsWith('<');
	const value = parseDecimal(lessThan ? s.slice(1) : s);
	return value === undefined ? undefined : { value, lessThan };
}

/** The field text for a stored value: "<0.5" for a less-than value, "0.5" otherwise. */
export const labelValueText = (n: NutrientValue): string =>
	(n.qualifier === 'less_than' ? '<' : '') + formatDecimal(n.value, 4);
