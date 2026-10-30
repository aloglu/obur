import { describe, expect, it } from 'vitest';
import { portionSource, preservedNutrients } from './food-edit.ts';

describe('editing a food through the form', () => {
	const initial = [
		{ code: 'energy_kcal' as const, value: 89, qualifier: 'reported' as const },
		{ code: 'carbohydrate_excl_fibre' as const, value: 20.2, qualifier: 'estimate' as const },
		{ code: 'potassium' as const, value: 358, qualifier: 'reported' as const },
		{ code: 'starch' as const, value: 5.4, qualifier: 'estimate' as const },
		{ code: 'iron' as const, value: 0.3, qualifier: 'derived' as const }
	];

	it('keeps values the form does not show, except derived ones', () => {
		// Reported potassium is a "More nutrients" row, so the form writes it; the starch estimate is kept.
		expect(preservedNutrients(initial, true).map((n) => n.code)).toEqual(['starch']);
	});

	it('replaces a kept value when a new one is entered for that nutrient', () => {
		expect(preservedNutrients(initial, true, ['starch'])).toEqual([]);
	});

	it('drops them when the basis changes, leaving them unknown', () => {
		expect(preservedNutrients(initial, false)).toEqual([]);
	});

	it('keeps a portion’s source only while it is unchanged', () => {
		const servings = [
			{ name: 'medium', amount: 118, unit: 'g' as const, source: 'reference' as const }
		];
		expect(portionSource(servings, { name: 'medium', amount: 118, unit: 'g' })).toBe('reference');
		expect(portionSource(servings, { name: 'medium', amount: 120, unit: 'g' })).toBe('user');
		expect(portionSource(servings, { name: 'large', amount: 136, unit: 'g' })).toBe('user');
	});
});
