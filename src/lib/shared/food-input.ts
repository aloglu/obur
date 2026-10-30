// Validation for creating and editing foods, shared by the form and the API.
import * as v from 'valibot';
import { isFoodIcon } from './food-icons.ts';
import { NUTRIENT_CODES, QUALIFIERS } from './nutrients.ts';

const text = (min: number, max: number) =>
	v.pipe(
		v.string(),
		v.transform((s) => s.normalize('NFC').replace(/\s+/g, ' ').trim()),
		v.minLength(min),
		v.maxLength(max)
	);
const optionalText = (max: number) =>
	v.pipe(
		v.optional(v.nullable(v.string()), null),
		v.transform((s) => (s ? s.normalize('NFC').replace(/\s+/g, ' ').trim() || null : null)),
		v.nullable(v.pipe(v.string(), v.maxLength(max)))
	);
const positive = v.pipe(v.number(), v.finite(), v.gtValue(0), v.maxValue(100_000));

export const NutrientInput = v.object({
	code: v.picklist(NUTRIENT_CODES),
	value: v.pipe(v.number(), v.finite(), v.minValue(0), v.maxValue(100_000)),
	qualifier: v.picklist(QUALIFIERS)
});

export const ServingInput = v.object({
	name: text(1, 60),
	amount: positive,
	unit: v.picklist(['g', 'ml']),
	source: v.optional(v.picklist(['label', 'user', 'estimate', 'reference']), 'user')
});

export const FoodInput = v.pipe(
	v.object({
		name: text(1, 200),
		brand: optionalText(120),
		visibility: v.picklist(['private', 'shared']),
		basis: v.picklist(['100g', '100ml', 'serving']),
		servingLabel: optionalText(60),
		servingSize: v.optional(
			v.nullable(v.object({ amount: positive, unit: v.picklist(['g', 'ml']) })),
			null
		),
		barcode: v.optional(v.nullable(v.pipe(v.string(), v.regex(/^\d{8,14}$/))), null),
		// Absent or null: no chosen icon (the name's suggestion shows).
		icon: v.optional(v.nullable(v.pipe(v.string(), v.check(isFoodIcon, 'Unknown icon')))),
		nutrients: v.pipe(v.array(NutrientInput), v.maxLength(NUTRIENT_CODES.length)),
		servings: v.optional(v.pipe(v.array(ServingInput), v.maxLength(20)), [])
	}),
	v.check(
		(f) => new Set(f.nutrients.map((n) => n.code)).size === f.nutrients.length,
		'Each nutrient may appear once'
	),
	v.check(
		(f) => (f.basis === 'serving') === Boolean(f.servingLabel),
		'A per-serving food needs a serving name, and only it'
	),
	v.check(
		(f) => !f.servingSize || f.basis === 'serving',
		'Serving size applies to per-serving foods'
	)
);

export type FoodInput = v.InferOutput<typeof FoodInput>;
