import { describe, expect, it } from 'vitest';
import { optionKeyFor, unitOptions } from './unit-options.ts';

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
		const options = unitOptions(
			{
				basis: '100ml',
				servingLabel: null,
				servings: [{ id: 'c', name: 'can', amount: 330, unit: 'ml' }]
			},
			measures
		);
		expect(options.map((o) => o.label)).toEqual(['can (330 ml)', 'ml', 'Su bardağı (200 ml)']);
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
