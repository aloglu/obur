import * as v from 'valibot';
import { describe, expect, it } from 'vitest';
import { foodWarnings } from './food-checks.ts';
import { FoodInput } from './food-input.ts';
import type { NutrientValue } from './nutrients.ts';

const n = (
	code: NutrientValue['code'],
	value: number,
	qualifier: NutrientValue['qualifier'] = 'reported'
) => ({
	code,
	value,
	qualifier
});

// Values from real Phase 0 labels (docs/feasibility.md).
const icimMiniTop = [
	n('energy_kj', 1098),
	n('energy_kcal', 265),
	n('fat', 21.5),
	n('saturated_fat', 14),
	n('carbohydrate_excl_fibre', 1.3),
	n('sugars', 1.3),
	n('protein', 16.5),
	n('salt', 1.2)
];

describe('foodWarnings', () => {
	it('accepts a consistent real label without warnings', () => {
		expect(foodWarnings('100g', icimMiniTop)).toEqual([]);
	});

	it('accepts a rounded zero-energy drink label', () => {
		const cokeZero = [
			n('energy_kj', 0.7),
			n('energy_kcal', 0.2),
			n('fat', 0),
			n('carbohydrate_excl_fibre', 0),
			n('protein', 0),
			n('salt', 0.02)
		];
		expect(foodWarnings('100ml', cokeZero)).toEqual([]);
	});

	it('flags OCR-style misreads such as "%28" read as 9628', () => {
		const misread = [
			n('energy_kcal', 330),
			n('fat', 0),
			n('carbohydrate_excl_fibre', 9628),
			n('sugars', 69),
			n('protein', 5.2)
		];
		expect(foodWarnings('100g', misread)).toEqual(
			expect.arrayContaining(['mass_exceeds_100', 'energy_macros_mismatch'])
		);
	});

	it('flags impossible sub-values and unit disagreements', () => {
		expect(
			foodWarnings('100g', [
				n('energy_kcal', 50),
				n('sugars', 12),
				n('carbohydrate_excl_fibre', 10)
			])
		).toContain('sugars_exceed_carbohydrate');
		expect(
			foodWarnings('100g', [n('energy_kcal', 50), n('saturated_fat', 3), n('fat', 2)])
		).toContain('saturated_exceeds_fat');
		expect(foodWarnings('100g', [n('energy_kj', 1000), n('energy_kcal', 400)])).toContain(
			'energy_units_mismatch'
		);
		expect(foodWarnings('100g', [n('energy_kcal', 50), n('salt', 1), n('sodium', 100)])).toContain(
			'salt_sodium_mismatch'
		);
	});

	it('does not treat "less than" bounds as exact values', () => {
		expect(
			foodWarnings('100g', [
				n('energy_kcal', 50),
				n('sugars', 0.5, 'less_than'),
				n('carbohydrate_excl_fibre', 0.2)
			])
		).toEqual([]);
	});

	it('notes missing energy rather than assuming zero', () => {
		expect(foodWarnings('serving', [n('protein', 20)])).toEqual(['energy_missing']);
	});
});

describe('FoodInput', () => {
	const base = {
		name: '  Sütaş   Ayran ',
		visibility: 'shared',
		basis: '100ml',
		nutrients: [n('energy_kcal', 36)]
	};

	it('normalises text and fills defaults', () => {
		const out = v.parse(FoodInput, base);
		expect(out).toMatchObject({
			name: 'Sütaş Ayran',
			brand: null,
			servings: [],
			servingSize: null
		});
	});

	it('requires a serving name exactly for per-serving foods', () => {
		expect(v.safeParse(FoodInput, { ...base, basis: 'serving' }).success).toBe(false);
		expect(
			v.safeParse(FoodInput, { ...base, basis: 'serving', servingLabel: '1 slice' }).success
		).toBe(true);
		expect(v.safeParse(FoodInput, { ...base, servingLabel: '1 slice' }).success).toBe(false);
	});

	it('rejects duplicate, negative and unknown nutrients', () => {
		expect(v.safeParse(FoodInput, { ...base, nutrients: [n('fat', 1), n('fat', 2)] }).success).toBe(
			false
		);
		expect(v.safeParse(FoodInput, { ...base, nutrients: [n('fat', -1)] }).success).toBe(false);
		expect(
			v.safeParse(FoodInput, {
				...base,
				nutrients: [{ code: 'magic', value: 1, qualifier: 'reported' }]
			}).success
		).toBe(false);
	});

	it('accepts only digit barcodes of supported lengths', () => {
		expect(v.safeParse(FoodInput, { ...base, barcode: '8697409148963' }).success).toBe(true);
		expect(v.safeParse(FoodInput, { ...base, barcode: '86974-0914' }).success).toBe(false);
	});

	it('checks energy against the macros with a "less than" value at its bound', () => {
		// Dried apricots with protein misread as 25 g (2,5 on the label) and fat "<0,5".
		const values = [
			n('energy_kcal', 298),
			n('fat', 0.5, 'less_than'),
			n('carbohydrate_excl_fibre', 69),
			n('protein', 25)
		];
		expect(foodWarnings('100g', values)).toContain('energy_macros_mismatch');
		values[3] = n('protein', 2.5);
		expect(foodWarnings('100g', values)).not.toContain('energy_macros_mismatch');
	});
});
