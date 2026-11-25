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
	// A carbohydrate typed in either definition replaces an imported one of unstated definition, which the diary
	// would otherwise keep showing (2026-11-25 Review.md audit, 1.4).
	const carbohydrate =
		entered.includes('carbohydrate_excl_fibre') || entered.includes('carbohydrate_total');
	return initial.filter(
		(n) =>
			!shownByForm(n) &&
			n.qualifier !== 'derived' &&
			!entered.includes(n.code) &&
			!(carbohydrate && n.code === 'carbohydrate_unspecified')
	);
}

/** How the form reads a label: EU (carbohydrate excluding fibre, salt in g) or US (total carbohydrate, sodium in mg). */
export type LabelType = 'eu' | 'us';

const reportedIn = (nutrients: NutrientValue[], code: NutrientCode) =>
	nutrients.find(
		(n) => n.code === code && (n.qualifier === 'reported' || n.qualifier === 'less_than')
	);

/**
 * The label type a food's values were written in: the carbohydrate's definition decides, then a sodium without salt
 * (2026-11-25 Review.md audit, 1.3: sodium alone made a carbohydrate excluding fibre show, and save, as total).
 */
export function labelTypeOf(nutrients: NutrientValue[]): LabelType {
	if (reportedIn(nutrients, 'carbohydrate_total')) return 'us';
	if (reportedIn(nutrients, 'carbohydrate_excl_fibre')) return 'eu';
	return reportedIn(nutrients, 'sodium') && !reportedIn(nutrients, 'salt') ? 'us' : 'eu';
}

const SALT_PER_SODIUM = 2.5; // EU Regulation 1169/2011, Annex I: salt = sodium × 2.5

/**
 * What the form's carbohydrate or salt row shows for a label type: only the type's own carbohydrate (the other
 * definition is a different number), and salt or sodium in the row's unit. A food with the other one only shows it
 * converted by the EU's definition, never grams in a milligram row (Review.md audit, 1.3).
 */
export function formRowValue(
	nutrients: NutrientValue[],
	field: 'carbohydrate' | 'salt',
	type: LabelType
): NutrientValue | undefined {
	if (field === 'carbohydrate')
		return reportedIn(nutrients, type === 'eu' ? 'carbohydrate_excl_fibre' : 'carbohydrate_total');
	const own = reportedIn(nutrients, type === 'eu' ? 'salt' : 'sodium');
	if (own) return own;
	const other = reportedIn(nutrients, type === 'eu' ? 'sodium' : 'salt');
	if (!other) return undefined;
	const value =
		type === 'eu' ? (other.value * SALT_PER_SODIUM) / 1000 : (other.value / SALT_PER_SODIUM) * 1000;
	return {
		code: type === 'eu' ? 'salt' : 'sodium',
		value: Math.round(value * 10_000) / 10_000,
		qualifier: other.qualifier
	};
}

/**
 * A scanned label's values for the form. With salt there too, as on Turkish and EU labels, salt is enough. A sodium
 * alone marks an American label, whose carbohydrate is the total: the label reader names every carbohydrate
 * excluding fibre, so it is renamed here (Review.md audit, 1.3: saved under the wrong definition).
 */
export function scannedNutrients(nutrients: NutrientValue[]): NutrientValue[] {
	if (nutrients.some((n) => n.code === 'salt')) return nutrients.filter((n) => n.code !== 'sodium');
	if (!nutrients.some((n) => n.code === 'sodium')) return nutrients;
	return nutrients.map((n) =>
		n.code === 'carbohydrate_excl_fibre' ? { ...n, code: 'carbohydrate_total' } : n
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
