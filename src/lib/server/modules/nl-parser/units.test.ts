import { describe, expect, it } from 'vitest';
import { proposeForFood, unitForFood } from './units.ts';

const per100g = (servings: { id: string; name: string; amount: number; unit: 'g' | 'ml' }[]) => ({
	basis: '100g' as const,
	servingLabel: null,
	servings
});
const bread = per100g([{ id: 's', name: 'dilim', amount: 26, unit: 'g' }]);
const banana = per100g([
	{ id: 'l', name: 'large (20–23 cm long)', amount: 136, unit: 'g' },
	{ id: 'm', name: 'medium (18–20 cm long)', amount: 118, unit: 'g' }
]);
const bar = { basis: 'serving' as const, servingLabel: '1 bar', servingSize: null, servings: [] };
const cola = {
	basis: '100ml' as const,
	servingLabel: null,
	servings: [{ id: 'c', name: 'can (355 ml)', amount: 355, unit: 'ml' as const }]
};

describe('unitForFood', () => {
	it('uses grams and millilitres only when the food converts from them', () => {
		expect(unitForFood({ kind: 'g' }, bread)).toEqual({ kind: 'mass', unit: 'g' });
		expect(unitForFood({ kind: 'ml' }, bread)).toBeNull();
		expect(unitForFood({ kind: 'g' }, bar)).toBeNull();
		expect(unitForFood({ kind: 'ml' }, cola)).toEqual({ kind: 'volume', unit: 'ml' });
	});

	it('matches count words to portions in either language', () => {
		expect(unitForFood({ kind: 'count', word: 'slice' }, bread)).toEqual({
			kind: 'serving',
			servingId: 's'
		});
		expect(unitForFood({ kind: 'count', word: 'can' }, cola)).toEqual({
			kind: 'serving',
			servingId: 'c'
		});
	});

	it('takes a medium portion or the food’s own serving for a bare count', () => {
		expect(unitForFood({ kind: 'count', word: null }, banana)).toEqual({
			kind: 'serving',
			servingId: 'm'
		});
		expect(unitForFood({ kind: 'count', word: null }, bar)).toEqual({ kind: 'basis_serving' });
		expect(unitForFood({ kind: 'count', word: 'package' }, bar)).toEqual({ kind: 'basis_serving' });
	});

	it('leaves the unit open rather than assume a size', () => {
		expect(unitForFood({ kind: 'count', word: 'slice' }, banana)).toBeNull();
		expect(unitForFood({ kind: 'count', word: 'bottle' }, bar)).toBeNull();
		expect(unitForFood({ kind: 'count', word: null }, per100g([]))).toBeNull();
		expect(unitForFood(null, bread)).toBeNull();
	});
});

describe('proposeForFood', () => {
	// The shape a LoseIt food logged in grams takes, and any food whose serving is only a weight.
	const weighed = {
		basis: 'serving' as const,
		servingLabel: '40 g',
		servingSize: { amount: 40, unit: 'g' as const },
		servings: []
	};
	const bar = { ...weighed, servingLabel: '1 bar' };
	const per100 = { basis: '100g' as const, servingLabel: null, servings: [] };

	it('proposes "two" of a weight-only serving in grams (regression, 2026-11-08)', () => {
		expect(proposeForFood(2, { kind: 'count', word: null }, weighed)).toEqual({
			unit: { kind: 'mass', unit: 'g' },
			amount: 80
		});
	});

	it('proposes one serving for a food named without an amount', () => {
		expect(proposeForFood(null, null, weighed)).toEqual({
			unit: { kind: 'mass', unit: 'g' },
			amount: 40
		});
		expect(proposeForFood(null, null, bar)).toEqual({
			unit: { kind: 'basis_serving' },
			amount: 1
		});
	});

	it('asks for a per-100 g food named without an amount, and keeps what was said', () => {
		expect(proposeForFood(null, null, per100)).toEqual({ unit: null, amount: null });
		expect(proposeForFood(150, { kind: 'g' }, per100)).toEqual({
			unit: { kind: 'mass', unit: 'g' },
			amount: 150
		});
		expect(proposeForFood(2, { kind: 'count', word: null }, bar)).toEqual({
			unit: { kind: 'basis_serving' },
			amount: 2
		});
	});
});
