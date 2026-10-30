// USDA FoodData Central records to curated foods (docs/design.md, "Food catalog and recipes"). Pure: no I/O. Used at
// build time on downloaded, public-domain datasets (SR Legacy, Foundation Foods); nothing is looked up at runtime.
//
// Nutrients are matched by USDA nutrient number and the unit is checked, so a dataset with different definitions
// fails loudly instead of being mis-mapped. Values are per 100 g of the food as described. Carbohydrate "by
// difference" includes fibre and is stored as total carbohydrate; carbohydrate excluding fibre is then derived as an
// estimate by the shared rules, as are salt from sodium and kJ from kcal. A nutrient the record lacks stays unknown.
import * as v from 'valibot';
import {
	deriveNutrients,
	type NutrientCode,
	type NutrientValue
} from '../../../shared/nutrients.ts';
import { metricPortionName } from './metric-portion.ts';

export type UsdaDataset = 'sr_legacy' | 'foundation';

/** USDA nutrient number → our code, with the unit USDA must state for it. */
const NUMBERS: Record<string, { code: NutrientCode; unit: string }> = {
	'208': { code: 'energy_kcal', unit: 'kcal' },
	'268': { code: 'energy_kj', unit: 'kJ' },
	'203': { code: 'protein', unit: 'g' },
	'204': { code: 'fat', unit: 'g' },
	'205': { code: 'carbohydrate_total', unit: 'g' },
	'291': { code: 'fibre', unit: 'g' },
	// SR Legacy "Total Sugars" and Foundation "Sugars, Total" (both total sugars).
	'269': { code: 'sugars', unit: 'g' },
	'269.3': { code: 'sugars', unit: 'g' },
	'209': { code: 'starch', unit: 'g' },
	'307': { code: 'sodium', unit: 'mg' },
	'606': { code: 'saturated_fat', unit: 'g' },
	'645': { code: 'monounsaturated_fat', unit: 'g' },
	'646': { code: 'polyunsaturated_fat', unit: 'g' },
	'605': { code: 'trans_fat', unit: 'g' },
	'601': { code: 'cholesterol', unit: 'mg' },
	'301': { code: 'calcium', unit: 'mg' },
	'306': { code: 'potassium', unit: 'mg' },
	'303': { code: 'iron', unit: 'mg' }
};
/**
 * Foundation Foods often lack plain energy (208). Then the Atwater specific factors (958) are used, which is how
 * SR Legacy's energy was computed, and failing that the general factors (957). The choice is recorded.
 */
const ENERGY_FALLBACKS = ['958', '957'] as const;

const UsdaFood = v.object({
	fdcId: v.pipe(v.number(), v.integer(), v.minValue(1)),
	description: v.pipe(v.string(), v.minLength(1)),
	publicationDate: v.optional(v.string()),
	foodNutrients: v.array(
		v.object({
			nutrient: v.object({
				number: v.optional(v.string()),
				name: v.string(),
				unitName: v.optional(v.string())
			}),
			amount: v.optional(v.number())
		})
	),
	foodPortions: v.optional(
		v.array(
			v.object({
				amount: v.optional(v.number()),
				value: v.optional(v.number()),
				gramWeight: v.optional(v.number()),
				modifier: v.optional(v.string()),
				portionDescription: v.optional(v.string()),
				measureUnit: v.optional(v.object({ name: v.optional(v.string()) }))
			})
		),
		[]
	)
});
export type UsdaFood = v.InferInput<typeof UsdaFood>;

export interface CuratedPortion {
	name: string;
	/** Grams in one portion. */
	grams: number;
}

export interface CuratedFood {
	dataset: UsdaDataset;
	fdcId: number;
	/** USDA's own description, kept as provenance. */
	description: string;
	publicationDate: string | null;
	energySource: '208' | '958' | '957';
	/** Per 100 g, including documented derivations. */
	nutrients: NutrientValue[];
	portions: CuratedPortion[];
}

export class UsdaError extends Error {}

/** The first few in USDA's order: enough choice without crowding the unit chips. */
const MAX_PORTIONS = 8;

const round = (n: number, places: number) => Math.round(n * 10 ** places) / 10 ** places;

/** "cup, chopped", "medium (7" to 7-7/8" long)", "tablespoon": one portion's name, at most 60 characters. */
function portionName(p: v.InferOutput<typeof UsdaFood>['foodPortions'][number]): string {
	const unit =
		p.measureUnit?.name && p.measureUnit.name !== 'undetermined' ? p.measureUnit.name : '';
	const modifier = (p.modifier ?? '').trim();
	// SR Legacy often repeats the unit in the modifier ("can" + "can 12 fl oz").
	let name = !unit
		? modifier
		: !modifier || modifier.toLowerCase().startsWith(unit.toLowerCase())
			? modifier || unit
			: `${unit}, ${modifier}`;
	if (!name && p.portionDescription) name = p.portionDescription;
	return name
		.replace(/\s+/g, ' ')
		.replace(/\b(\w+) \1\b/gi, '$1') // "can can 12 fl oz" in SR Legacy's own text
		.trim()
		.slice(0, 60)
		.trim();
}

export function curatedFromUsda(dataset: UsdaDataset, raw: unknown): CuratedFood {
	const parsed = v.safeParse(UsdaFood, raw);
	if (!parsed.success)
		throw new UsdaError(`Not a FoodData Central food: ${parsed.issues[0].message}`);
	const food = parsed.output;

	const byNumber = new Map<string, number>();
	for (const n of food.foodNutrients) {
		const number = n.nutrient.number;
		if (number === undefined || n.amount === undefined) continue;
		const known =
			NUMBERS[number] ?? (ENERGY_FALLBACKS.includes(number as never) && { unit: 'kcal' });
		if (!known) continue;
		if (n.nutrient.unitName !== known.unit)
			throw new UsdaError(
				`${food.fdcId}: nutrient ${number} (${n.nutrient.name}) is in ${n.nutrient.unitName}, expected ${known.unit}`
			);
		if (!Number.isFinite(n.amount) || n.amount < 0)
			throw new UsdaError(`${food.fdcId}: nutrient ${number} has an invalid amount`);
		byNumber.set(number, n.amount);
	}

	const energySource = (['208', ...ENERGY_FALLBACKS] as const).find((n) => byNumber.has(n));
	if (!energySource) throw new UsdaError(`${food.fdcId}: no energy value`);
	const values = new Map<NutrientCode, NutrientValue>();
	values.set('energy_kcal', {
		code: 'energy_kcal',
		value: round(byNumber.get(energySource)!, 2),
		qualifier: 'reported'
	});
	for (const [number, amount] of byNumber) {
		const known = NUMBERS[number];
		if (!known || known.code === 'energy_kcal') continue;
		// kJ is reported only alongside plain energy; with a fallback it is derived from the kcal used.
		if (known.code === 'energy_kj' && energySource !== '208') continue;
		if (!values.has(known.code))
			values.set(known.code, { code: known.code, value: round(amount, 3), qualifier: 'reported' });
	}

	const portions: CuratedPortion[] = [];
	for (const p of food.foodPortions) {
		if (p.measureUnit?.name === 'RACC') continue; // a US labelling reference amount, not a portion
		const count = p.amount ?? p.value;
		const usName = portionName(p);
		if (/^NLEA serving$/i.test(usName)) continue; // likewise
		const name = usName && metricPortionName(usName);
		if (!name || !count || count <= 0 || !p.gramWeight || p.gramWeight <= 0) continue;
		if (portions.some((x) => x.name === name)) continue;
		portions.push({ name, grams: round(p.gramWeight / count, 2) });
		if (portions.length === MAX_PORTIONS) break;
	}

	return {
		dataset,
		fdcId: food.fdcId,
		description: food.description,
		publicationDate: food.publicationDate ?? null,
		energySource,
		nutrients: deriveNutrients([...values.values()]),
		portions
	};
}
