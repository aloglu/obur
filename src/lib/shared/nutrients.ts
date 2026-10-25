// The nutrient contract (docs/design.md, "Data model and nutrient contract"). Codes are stored in the database;
// adding one needs a migration (food_nutrients_code_valid).

export const NUTRIENTS = {
	energy_kcal: { unit: 'kcal', core: true },
	energy_kj: { unit: 'kJ', core: false },
	fat: { unit: 'g', core: true },
	saturated_fat: { unit: 'g', core: true },
	// EU/Turkish label "carbohydrate" excludes fibre; the dashboard uses this one.
	carbohydrate_excl_fibre: { unit: 'g', core: true },
	// USDA/US label "total carbohydrate" includes fibre. Never summed with the one above.
	carbohydrate_total: { unit: 'g', core: false },
	sugars: { unit: 'g', core: true },
	fibre: { unit: 'g', core: true },
	protein: { unit: 'g', core: true },
	salt: { unit: 'g', core: true },
	sodium: { unit: 'mg', core: false },
	polyols: { unit: 'g', core: false },
	starch: { unit: 'g', core: false },
	monounsaturated_fat: { unit: 'g', core: false },
	polyunsaturated_fat: { unit: 'g', core: false },
	trans_fat: { unit: 'g', core: false },
	cholesterol: { unit: 'mg', core: false },
	calcium: { unit: 'mg', core: false },
	potassium: { unit: 'mg', core: false },
	iron: { unit: 'mg', core: false }
} as const;

export type NutrientCode = keyof typeof NUTRIENTS;
export const NUTRIENT_CODES = Object.keys(NUTRIENTS) as NutrientCode[];

/** reported: as printed; less_than: the value is an upper bound ("<0,5 g"); derived: calculated from other
 * reported values by a documented rule; estimate: entered or computed without a source measurement. */
export const QUALIFIERS = ['reported', 'less_than', 'derived', 'estimate'] as const;
export type Qualifier = (typeof QUALIFIERS)[number];

export interface NutrientValue {
	code: NutrientCode;
	value: number;
	qualifier: Qualifier;
}

const KJ_PER_KCAL = 4.184;
const SALT_PER_SODIUM = 2.5; // EU Regulation 1169/2011, Annex I: salt = sodium × 2.5

/**
 * Adds values that follow from reported ones by documented rules, marking them `derived` or `estimate`,
 * without ever overwriting a value the source gave:
 * - kcal from kJ (or kJ from kcal) at 4.184 kJ/kcal;
 * - salt (g) from sodium (mg) × 2.5 / 1000;
 * - carbohydrate excluding fibre from total carbohydrate minus fibre, as an estimate, only when both are
 *   known exact values and the result is not negative.
 */
export function deriveNutrients(values: NutrientValue[]): NutrientValue[] {
	const out = new Map(values.map((v) => [v.code, v]));
	const exact = (code: NutrientCode) => {
		const v = out.get(code);
		return v && v.qualifier !== 'less_than' ? v : undefined;
	};
	const add = (code: NutrientCode, value: number, qualifier: Qualifier) => {
		if (!out.has(code)) out.set(code, { code, value: round(value), qualifier });
	};

	const kj = out.get('energy_kj');
	const kcal = out.get('energy_kcal');
	if (kj && !kcal)
		add(
			'energy_kcal',
			kj.value / KJ_PER_KCAL,
			kj.qualifier === 'less_than' ? 'less_than' : 'derived'
		);
	if (kcal && !kj)
		add(
			'energy_kj',
			kcal.value * KJ_PER_KCAL,
			kcal.qualifier === 'less_than' ? 'less_than' : 'derived'
		);

	const sodium = out.get('sodium');
	if (sodium)
		add(
			'salt',
			(sodium.value * SALT_PER_SODIUM) / 1000,
			sodium.qualifier === 'less_than' ? 'less_than' : 'derived'
		);

	const total = exact('carbohydrate_total');
	const fibre = exact('fibre');
	if (total && fibre && total.value - fibre.value >= 0) {
		add('carbohydrate_excl_fibre', total.value - fibre.value, 'estimate');
	}
	return NUTRIENT_CODES.flatMap((code) => (out.has(code) ? [out.get(code)!] : []));
}

const round = (v: number) => Math.round(v * 10_000) / 10_000;
