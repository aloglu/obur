import { describe, expect, it } from 'vitest';
import { curatedFromUsda, UsdaError } from './usda.ts';

const nutrient = (number: string, name: string, unitName: string, amount: number) => ({
	nutrient: { number, name, unitName },
	amount
});

// Shaped like SR Legacy records; values are illustrative.
const banana = {
	fdcId: 173944,
	description: 'Bananas, raw',
	publicationDate: '4/1/2019',
	foodNutrients: [
		nutrient('208', 'Energy', 'kcal', 89),
		nutrient('268', 'Energy', 'kJ', 371),
		nutrient('203', 'Protein', 'g', 1.09),
		nutrient('204', 'Total lipid (fat)', 'g', 0.33),
		nutrient('205', 'Carbohydrate, by difference', 'g', 22.84),
		nutrient('291', 'Fiber, total dietary', 'g', 2.6),
		nutrient('269', 'Total Sugars', 'g', 12.23),
		nutrient('307', 'Sodium, Na', 'mg', 1),
		nutrient('334', 'Cryptoxanthin, beta', 'µg', 0)
	],
	foodPortions: [
		{ amount: 1, modifier: 'cup, mashed', gramWeight: 225, measureUnit: { name: 'undetermined' } },
		{ amount: 1, modifier: 'medium (7" to 7-7/8" long)', gramWeight: 118 },
		{ amount: 0.5, modifier: 'cup, sliced', gramWeight: 75 },
		{ amount: 1, gramWeight: 126, measureUnit: { name: 'RACC' } },
		{ amount: 1, modifier: 'cup, mashed', gramWeight: 230 },
		{ amount: 1, modifier: 'NLEA serving', gramWeight: 126 },
		{
			amount: 1,
			modifier: 'can can 12 fl oz',
			gramWeight: 355,
			measureUnit: { name: 'undetermined' }
		},
		...Array.from({ length: 8 }, (_, i) => ({ amount: 1, modifier: `extra ${i}`, gramWeight: 10 }))
	]
};

describe('curatedFromUsda', () => {
	it('maps nutrients per 100 g, keeps total carbohydrate and derives the rest as marked values', () => {
		const food = curatedFromUsda('sr_legacy', banana);
		const by = Object.fromEntries(food.nutrients.map((n) => [n.code, n]));
		expect(by.energy_kcal).toEqual({ code: 'energy_kcal', value: 89, qualifier: 'reported' });
		expect(by.energy_kj).toEqual({ code: 'energy_kj', value: 371, qualifier: 'reported' });
		expect(by.carbohydrate_total).toEqual({
			code: 'carbohydrate_total',
			value: 22.84,
			qualifier: 'reported'
		});
		// Fibre is included in USDA carbohydrate: the excluding-fibre value is only an estimate.
		expect(by.carbohydrate_excl_fibre).toEqual({
			code: 'carbohydrate_excl_fibre',
			value: 20.24,
			qualifier: 'estimate'
		});
		expect(by.salt).toMatchObject({ value: 0.0025, qualifier: 'derived' });
		expect(by.sugars.value).toBe(12.23);
		// Not in the record: unknown, never zero.
		expect(by.saturated_fat).toBeUndefined();
		expect(food).toMatchObject({ fdcId: 173944, description: 'Bananas, raw', energySource: '208' });
	});

	it('takes up to eight portions with their stated gram weights, per one portion, without labelling references', () => {
		expect(curatedFromUsda('sr_legacy', banana).portions).toEqual([
			{ name: 'US cup (237 ml), mashed', grams: 225 },
			{ name: 'medium (18–20 cm long)', grams: 118 },
			{ name: 'US cup (237 ml), sliced', grams: 150 },
			{ name: 'can (355 ml)', grams: 355 },
			{ name: 'extra 0', grams: 10 },
			{ name: 'extra 1', grams: 10 },
			{ name: 'extra 2', grams: 10 },
			{ name: 'extra 3', grams: 10 }
		]);
	});

	it('names Foundation portions by their unit and uses Atwater energy when plain energy is missing', () => {
		const food = curatedFromUsda('foundation', {
			fdcId: 2346393,
			description: 'Nuts, almonds, whole, raw',
			foodNutrients: [
				nutrient('957', 'Energy (Atwater General Factors)', 'kcal', 620),
				nutrient('958', 'Energy (Atwater Specific Factors)', 'kcal', 594),
				nutrient('269.3', 'Sugars, Total', 'g', 4.2)
			],
			foodPortions: [
				{ value: 2, gramWeight: 28, measureUnit: { name: 'tablespoon' }, modifier: '' }
			]
		});
		expect(food.energySource).toBe('958');
		expect(food.nutrients).toContainEqual({
			code: 'energy_kcal',
			value: 594,
			qualifier: 'reported'
		});
		expect(food.nutrients).toContainEqual({
			code: 'energy_kj',
			value: 2485.296,
			qualifier: 'derived'
		});
		expect(food.nutrients).toContainEqual({ code: 'sugars', value: 4.2, qualifier: 'reported' });
		expect(food.portions).toEqual([{ name: 'tablespoon', grams: 14 }]);
	});

	it('refuses records with unexpected units, no energy or a different shape', () => {
		expect(() =>
			curatedFromUsda('sr_legacy', {
				...banana,
				foodNutrients: [nutrient('307', 'Sodium, Na', 'g', 0.001), ...banana.foodNutrients]
			})
		).toThrow(UsdaError);
		expect(() =>
			curatedFromUsda('sr_legacy', { ...banana, foodNutrients: [banana.foodNutrients[2]] })
		).toThrow('no energy');
		expect(() => curatedFromUsda('sr_legacy', { description: 'x' })).toThrow(UsdaError);
	});
});
