import { describe, expect, it } from 'vitest';
import { deriveNutrients, type NutrientValue } from './nutrients.ts';
import { formatDecimal, parseDecimal } from './numbers.ts';
import {
	basisFactor,
	scaleNutrients,
	supportedDimensions,
	type QuantityModel
} from './quantity.ts';
import { foldForSearch, foodSearchKey } from './search-text.ts';

describe('foldForSearch', () => {
	it.each([
		['Sütaş Ayran', 'sutas ayran'],
		['İÇİM Mini Top Peynir', 'icim mini top peynir'],
		['ISPANAK', 'ispanak'],
		['ıspanak', 'ispanak'],
		['Körpe Ispanak', 'korpe ispanak'],
		['Tavuk göğsü, çiğ', 'tavuk gogsu cig'],
		['Coca-Cola Zero', 'coca cola zero'],
		['INTEL INSIDE', 'intel inside'],
		['Café crème', 'cafe creme'],
		['Straße', 'strasse'],
		['Kıyma %10 yağlı', 'kiyma 10 yagli'],
		['  Fellas   HighPro+  ', 'fellas highpro']
	])('%s → %s', (input, folded) => {
		expect(foldForSearch(input)).toBe(folded);
	});

	it('folds composed and decomposed forms identically', () => {
		expect(foldForSearch('Sütaş')).toBe(foldForSearch('Sütaş'));
	});

	it('puts the brand into the food key', () => {
		expect(foodSearchKey('Ayran', 'Sütaş')).toBe('sutas ayran');
		expect(foodSearchKey('Ayran', null)).toBe('ayran');
	});
});

describe('parseDecimal', () => {
	it.each([
		['82,4', 82.4],
		['82.4', 82.4],
		[' 1,5 ', 1.5],
		['0', 0],
		[',5', 0.5],
		['200', 200],
		['1.234', 1.234],
		['1,234', 1.234]
	])('%s → %s', (input, value) => {
		expect(parseDecimal(input)).toBe(value);
	});

	it.each(['', '1,234.5', '1.234,5', '1,2,3', '-1', 'abc', '1e3', '82,', '12 kg'])(
		'rejects %j instead of guessing',
		(input) => {
			expect(parseDecimal(input)).toBeUndefined();
		}
	);

	it('formats with the person’s decimal mark', () => {
		expect(formatDecimal(82.4)).toBe('82,4');
		expect(formatDecimal(82.4, '.')).toBe('82.4');
		expect(formatDecimal(2)).toBe('2');
		expect(formatDecimal(0.125, ',', 2)).toBe('0,13');
		// Regression: whole numbers keep their zeros (200 once became "2").
		expect(formatDecimal(200, ',', 0)).toBe('200');
		expect(formatDecimal(1500, ',', 2)).toBe('1500');
		expect(formatDecimal(330, ',', 1)).toBe('330');
		expect(formatDecimal(2.5, ',', 2)).toBe('2,5');
		expect(formatDecimal(0, ',', 2)).toBe('0');
	});
});

describe('deriveNutrients', () => {
	const v = (
		code: NutrientValue['code'],
		value: number,
		qualifier: NutrientValue['qualifier'] = 'reported'
	) => ({
		code,
		value,
		qualifier
	});

	it('derives kcal from kJ but never overwrites a reported value', () => {
		expect(deriveNutrients([v('energy_kj', 1098)]).find((n) => n.code === 'energy_kcal')).toEqual(
			v('energy_kcal', 262.4283, 'derived')
		);
		const both = deriveNutrients([v('energy_kj', 1098), v('energy_kcal', 265)]);
		expect(both.find((n) => n.code === 'energy_kcal')).toEqual(v('energy_kcal', 265));
	});

	it('derives salt from sodium and keeps the sodium', () => {
		const out = deriveNutrients([v('sodium', 480)]);
		expect(out).toContainEqual(v('salt', 1.2, 'derived'));
		expect(out).toContainEqual(v('sodium', 480));
	});

	it('keeps a "less than" bound a bound when deriving', () => {
		expect(deriveNutrients([v('sodium', 5, 'less_than')])).toContainEqual(
			v('salt', 0.0125, 'less_than')
		);
	});

	it('estimates carbohydrate excluding fibre from US totals only when the result is sound', () => {
		expect(deriveNutrients([v('carbohydrate_total', 73), v('fibre', 3)])).toContainEqual(
			v('carbohydrate_excl_fibre', 70, 'estimate')
		);
		// Missing fibre, a bounded value or a negative result leave it unknown.
		const missing = deriveNutrients([v('carbohydrate_total', 73)]);
		expect(missing.some((n) => n.code === 'carbohydrate_excl_fibre')).toBe(false);
		const bounded = deriveNutrients([v('carbohydrate_total', 0.5, 'less_than'), v('fibre', 0)]);
		expect(bounded.some((n) => n.code === 'carbohydrate_excl_fibre')).toBe(false);
		const negative = deriveNutrients([v('carbohydrate_total', 2), v('fibre', 3)]);
		expect(negative.some((n) => n.code === 'carbohydrate_excl_fibre')).toBe(false);
	});

	it('never turns an absent nutrient into zero', () => {
		const out = deriveNutrients([v('energy_kcal', 100)]);
		expect(out.map((n) => n.code).sort()).toEqual(['energy_kcal', 'energy_kj']);
	});
});

describe('basisFactor', () => {
	const per100g: QuantityModel = {
		basis: '100g',
		servings: [
			{ id: 'slice', name: 'slice', amount: 26, unit: 'g' },
			{ id: 'cup', name: 'cup', amount: 240, unit: 'ml' }
		]
	};
	const per100ml: QuantityModel = {
		basis: '100ml',
		servings: [{ id: 'can', name: 'can', amount: 330, unit: 'ml' }]
	};
	const perBarWithMass: QuantityModel = {
		basis: 'serving',
		servingSize: { amount: 40, unit: 'g' },
		servings: [{ id: 'half', name: 'half bar', amount: 20, unit: 'g' }]
	};
	const perSliceUnknownMass: QuantityModel = { basis: 'serving', servingSize: null, servings: [] };

	it('scales per-100 g foods by mass and by mass-based portions', () => {
		expect(basisFactor(per100g, 250, { kind: 'mass', unit: 'g' })).toBe(2.5);
		expect(basisFactor(per100g, 0.5, { kind: 'mass', unit: 'kg' })).toBe(5);
		expect(basisFactor(per100g, 3, { kind: 'serving', servingId: 'slice' })).toBeCloseTo(0.78);
		expect(basisFactor(per100g, 1, { kind: 'mass', unit: 'oz' })).toBeCloseTo(0.28349523125);
	});

	it('refuses volume for a per-100 g food: no density is assumed', () => {
		expect(basisFactor(per100g, 200, { kind: 'volume', unit: 'ml' })).toBeUndefined();
		expect(basisFactor(per100g, 1, { kind: 'measure', ml: 200 })).toBeUndefined();
		expect(basisFactor(per100g, 1, { kind: 'serving', servingId: 'cup' })).toBeUndefined();
	});

	it('scales per-100 ml foods by volume, household measures and cup systems', () => {
		expect(basisFactor(per100ml, 1, { kind: 'serving', servingId: 'can' })).toBe(3.3);
		expect(basisFactor(per100ml, 2, { kind: 'measure', ml: 200 })).toBe(4);
		expect(basisFactor(per100ml, 1, { kind: 'volume', unit: 'us_cup' })).toBeCloseTo(2.365882365);
		expect(basisFactor(per100ml, 1, { kind: 'volume', unit: 'metric_cup' })).toBe(2.5);
		expect(basisFactor(per100ml, 100, { kind: 'mass', unit: 'g' })).toBeUndefined();
	});

	it('counts per-serving foods and converts by mass only when the serving size is stated', () => {
		expect(basisFactor(perBarWithMass, 2, { kind: 'basis_serving' })).toBe(2);
		expect(basisFactor(perBarWithMass, 60, { kind: 'mass', unit: 'g' })).toBe(1.5);
		expect(basisFactor(perBarWithMass, 1, { kind: 'serving', servingId: 'half' })).toBe(0.5);
		expect(basisFactor(perBarWithMass, 100, { kind: 'volume', unit: 'ml' })).toBeUndefined();

		expect(basisFactor(perSliceUnknownMass, 3, { kind: 'basis_serving' })).toBe(3);
		expect(basisFactor(perSliceUnknownMass, 75, { kind: 'mass', unit: 'g' })).toBeUndefined();
	});

	it('rejects non-positive, non-finite and unknown inputs', () => {
		expect(basisFactor(per100g, 0, { kind: 'mass', unit: 'g' })).toBeUndefined();
		expect(basisFactor(per100g, -5, { kind: 'mass', unit: 'g' })).toBeUndefined();
		expect(basisFactor(per100g, Number.NaN, { kind: 'mass', unit: 'g' })).toBeUndefined();
		expect(basisFactor(per100g, 1, { kind: 'serving', servingId: 'missing' })).toBeUndefined();
		expect(basisFactor(per100g, 1, { kind: 'basis_serving' })).toBeUndefined();
	});

	it('reports which dimensions a food supports', () => {
		expect(supportedDimensions(per100g)).toEqual({ mass: true, volume: false });
		expect(supportedDimensions(per100ml)).toEqual({ mass: false, volume: true });
		expect(supportedDimensions(perBarWithMass)).toEqual({ mass: true, volume: false });
		expect(supportedDimensions(perSliceUnknownMass)).toEqual({ mass: false, volume: false });
	});

	it('scales nutrients and keeps qualifiers', () => {
		expect(
			scaleNutrients(
				[
					{ code: 'energy_kcal', value: 193, qualifier: 'reported' },
					{ code: 'fat', value: 0.5, qualifier: 'less_than' }
				],
				0.78
			)
		).toEqual([
			{ code: 'energy_kcal', value: 150.54, qualifier: 'reported' },
			{ code: 'fat', value: 0.39, qualifier: 'less_than' }
		]);
	});
});
