import { describe, expect, it } from 'vitest';
import {
	formRowValue,
	labelTypeOf,
	labelValueText,
	parseLabelValue,
	portionSource,
	preservedNutrients,
	scannedNutrients
} from './food-edit.ts';
import type { NutrientValue } from './nutrients.ts';

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

describe('a label value typed in a field', () => {
	it('reads a leading "<" as "less than", with either decimal mark and spaces', () => {
		expect(parseLabelValue('<0.5')).toEqual({ value: 0.5, lessThan: true });
		expect(parseLabelValue(' < 0,5 ')).toEqual({ value: 0.5, lessThan: true });
		expect(parseLabelValue('12')).toEqual({ value: 12, lessThan: false });
	});

	it('is unknown when empty or not a number, never zero', () => {
		expect(parseLabelValue('')).toBeUndefined();
		expect(parseLabelValue('<')).toBeUndefined();
		expect(parseLabelValue('<<1')).toBeUndefined();
		expect(parseLabelValue('1<')).toBeUndefined();
	});

	it('writes a stored value back the way it was read', () => {
		const lessThan = { code: 'salt' as const, value: 0.5, qualifier: 'less_than' as const };
		expect(parseLabelValue(labelValueText(lessThan))).toEqual({ value: 0.5, lessThan: true });
		expect(labelValueText({ ...lessThan, qualifier: 'reported' })).toBe('0.5');
	});
});

describe('carbohydrate and salt in the form (2026-11-25 Review.md audit, 1.3 and 1.4)', () => {
	const v = (code: NutrientValue['code'], value: number): NutrientValue => ({
		code,
		value,
		qualifier: 'reported'
	});

	it('drops an imported carbohydrate of unstated definition once a carbohydrate is typed', () => {
		const imported = [v('energy_kcal', 200), v('carbohydrate_unspecified', 30), v('sodium', 400)];
		expect(preservedNutrients(imported, true).map((n) => n.code)).toEqual([
			'carbohydrate_unspecified'
		]);
		expect(preservedNutrients(imported, true, ['energy_kcal', 'carbohydrate_total'])).toEqual([]);
		expect(preservedNutrients(imported, true, ['carbohydrate_excl_fibre'])).toEqual([]);
	});

	it('takes the label type from the carbohydrate first, then from sodium without salt', () => {
		expect(labelTypeOf([v('carbohydrate_excl_fibre', 10), v('sodium', 400)])).toBe('eu');
		expect(labelTypeOf([v('carbohydrate_total', 10), v('salt', 1)])).toBe('us');
		expect(labelTypeOf([v('sodium', 400)])).toBe('us');
		expect(labelTypeOf([v('salt', 1), v('sodium', 400)])).toBe('eu');
		expect(labelTypeOf([])).toBe('eu');
	});

	it('shows only the label type’s own carbohydrate, and salt or sodium in the row’s unit', () => {
		const both = [v('carbohydrate_excl_fibre', 10), v('salt', 1.2), v('sodium', 480)];
		expect(formRowValue(both, 'carbohydrate', 'us')).toBeUndefined();
		expect(formRowValue(both, 'carbohydrate', 'eu')?.value).toBe(10);
		expect(formRowValue(both, 'salt', 'eu')).toMatchObject({ code: 'salt', value: 1.2 });
		expect(formRowValue(both, 'salt', 'us')).toMatchObject({ code: 'sodium', value: 480 });
		// Only the other one: converted, never grams in the milligram row.
		expect(formRowValue([v('salt', 1.2)], 'salt', 'us')).toMatchObject({
			code: 'sodium',
			value: 480
		});
		expect(formRowValue([v('sodium', 400)], 'salt', 'eu')).toMatchObject({
			code: 'salt',
			value: 1
		});
	});

	it('reads a scanned label with sodium and no salt as American: its carbohydrate is the total', () => {
		const us = scannedNutrients([
			v('carbohydrate_excl_fibre', 30),
			v('fibre', 5),
			v('sodium', 400)
		]);
		expect(us.map((n) => n.code)).toEqual(['carbohydrate_total', 'fibre', 'sodium']);
		expect(labelTypeOf(us)).toBe('us');
		const eu = scannedNutrients([v('carbohydrate_excl_fibre', 30), v('salt', 1), v('sodium', 400)]);
		expect(eu.map((n) => n.code)).toEqual(['carbohydrate_excl_fibre', 'salt']);
		expect(labelTypeOf(eu)).toBe('eu');
	});
});
