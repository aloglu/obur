import { describe, expect, it } from 'vitest';
import { recipeNutrients } from './recipe.ts';

const exact = (value: number) => ({ value, qualifier: 'reported' as const });

describe('recipe values per serving', () => {
	it('adds the ingredients and divides by the servings', () => {
		const lentils = { energy_kcal: exact(700), protein: exact(48) };
		const onion = {
			energy_kcal: { value: 40, qualifier: 'derived' as const },
			protein: exact(1.1)
		};
		expect(recipeNutrients([lentils, onion], 4)).toEqual([
			{ code: 'energy_kcal', value: 185, qualifier: 'derived' },
			{ code: 'protein', value: 12.275, qualifier: 'derived' }
		]);
	});

	it('leaves a nutrient unknown when any ingredient lacks it, never counting it as zero', () => {
		const out = recipeNutrients(
			[{ energy_kcal: exact(100), sugars: exact(5) }, { energy_kcal: exact(50) }],
			1
		);
		expect(out.map((n) => n.code)).toEqual(['energy_kcal']);
	});

	it('marks the result an estimate when any part is an estimate or an upper bound', () => {
		const out = recipeNutrients(
			[
				{ fat: exact(10), salt: { value: 0.1, qualifier: 'less_than' as const } },
				{ fat: { value: 2, qualifier: 'estimate' as const }, salt: exact(1) }
			],
			2
		);
		expect(out).toEqual([
			{ code: 'fat', value: 6, qualifier: 'estimate' },
			{ code: 'salt', value: 0.55, qualifier: 'estimate' }
		]);
	});

	it('gives nothing without ingredients or servings', () => {
		expect(recipeNutrients([], 2)).toEqual([]);
		expect(recipeNutrients([{ energy_kcal: exact(1) }], 0)).toEqual([]);
	});
});
