import { describe, expect, it } from 'vitest';
import { offeredAmount, optionKeyFor, unitOptions } from './unit-options.ts';
import { overwriteLocale } from './test-locale.ts';

const measures = [{ code: 'su_bardagi', name: 'Su bardağı', ml: 200 }];

describe('unitOptions', () => {
	it('offers grams and gram portions for a per-100 g food, never volumes', () => {
		const options = unitOptions(
			{
				basis: '100g',
				servingLabel: null,
				servings: [
					{ id: 'a', name: 'slice', amount: 26, unit: 'g' },
					{ id: 'b', name: 'cup', amount: 240, unit: 'ml' }
				]
			},
			measures
		);
		expect(options.map((o) => o.label)).toEqual(['slice (26 g)', 'g']);
	});

	it('offers ml, household measures and ml portions for a per-100 ml food', () => {
		const food = {
			basis: '100ml' as const,
			servingLabel: null,
			servings: [{ id: 'c', name: 'can', amount: 330, unit: 'ml' as const }]
		};
		const options = unitOptions(food, measures);
		expect(options.map((o) => o.label)).toEqual(['can (330 ml)', 'ml', 'Water glass (200 ml)']);
		// The same measure in Turkish; the typed "can" is an everyday portion word, so it shows in Turkish too.
		expect(overwriteLocale('tr', () => unitOptions(food, measures)).map((o) => o.label)).toEqual([
			'kutu (330 ml)',
			'ml',
			'Su bardağı (200 ml)'
		]);
	});

	it('offers the serving, and grams only when the serving weight is known', () => {
		const known = unitOptions(
			{
				basis: 'serving',
				servingLabel: '1 bar',
				servingSize: { amount: 40, unit: 'g' },
				servings: []
			},
			measures
		);
		expect(known.map((o) => o.label)).toEqual(['1 bar', 'g']);
		const unknown = unitOptions(
			{ basis: 'serving', servingLabel: '1 slice', servingSize: null, servings: [] },
			measures
		);
		expect(unknown.map((o) => o.label)).toEqual(['1 slice']);
	});

	it('leaves out a serving whose label only restates its size, unless an entry uses it', () => {
		const food = {
			basis: 'serving' as const,
			servingLabel: '100 g',
			servingSize: { amount: 100, unit: 'g' as const },
			servings: []
		};
		expect(unitOptions(food, measures).map((o) => o.label)).toEqual(['g']);
		expect(
			unitOptions(
				{ ...food, servingLabel: '12,5 G', servingSize: { amount: 12.5, unit: 'g' } },
				measures
			).map((o) => o.label)
		).toEqual(['g']);
		expect(
			unitOptions(
				{ ...food, servingLabel: '45 g', servingSize: { amount: 45, unit: 'g' } },
				measures
			)[0].defaultAmount
		).toBe(45);
		expect(unitOptions(food, measures, true).map((o) => o.label)).toEqual(['100 g', 'g']);
		expect(
			unitOptions({ ...food, servingLabel: '1 cup (100 g)' }, measures).map((o) => o.label)
		).toEqual(['1 cup (100 g)', 'g']);
	});

	it('maps stored units back to option keys', () => {
		expect(optionKeyFor({ kind: 'basis_serving' })).toBe('basis');
		expect(optionKeyFor({ kind: 'mass', unit: 'g' })).toBe('g');
		expect(optionKeyFor({ kind: 'measure', code: 'su_bardagi', name: 'Su bardağı', ml: 200 })).toBe(
			'measure:su_bardagi'
		);
		expect(
			optionKeyFor({ kind: 'serving', servingId: 'a', name: 'slice', amount: 26, unit: 'g' })
		).toBe('serving:a');
	});
});

describe('offeredAmount', () => {
	const restated = {
		basis: 'serving' as const,
		servingLabel: '40 g',
		servingSize: { amount: 40, unit: 'g' as const },
		servings: []
	};

	it('turns a hidden serving into its weight, so the sheet can show it', () => {
		// Regression (2026-11-08): "two <food>" proposed a serving the sheet hid, leaving no unit and no kcal.
		expect(unitOptions(restated, measures).map((o) => o.key)).toEqual(['g']);
		expect(offeredAmount(restated, { kind: 'basis_serving' }, 2)).toEqual({
			unit: { kind: 'mass', unit: 'g' },
			amount: 80
		});
		expect(offeredAmount(restated, { kind: 'basis_serving' }, null)).toEqual({
			unit: { kind: 'mass', unit: 'g' },
			amount: null
		});
	});

	it('does the same for a serving that only restates millilitres', () => {
		const drink = {
			...restated,
			servingLabel: '330 ml',
			servingSize: { amount: 330, unit: 'ml' as const }
		};
		expect(offeredAmount(drink, { kind: 'basis_serving' }, 1)).toEqual({
			unit: { kind: 'volume', unit: 'ml' },
			amount: 330
		});
	});

	it('leaves a named serving, and every other unit, as proposed', () => {
		const bar = { ...restated, servingLabel: '1 bar' };
		expect(offeredAmount(bar, { kind: 'basis_serving' }, 2)).toEqual({
			unit: { kind: 'basis_serving' },
			amount: 2
		});
		expect(offeredAmount(restated, { kind: 'mass', unit: 'g' }, 30)).toEqual({
			unit: { kind: 'mass', unit: 'g' },
			amount: 30
		});
		expect(offeredAmount(restated, null, 2)).toEqual({ unit: null, amount: 2 });
	});
});
