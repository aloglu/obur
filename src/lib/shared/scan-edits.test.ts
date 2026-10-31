import { describe, expect, it } from 'vitest';
import type { NutrientValue } from './nutrients.ts';
import { scanEdits } from './scan-edits.ts';

const n = (
	code: NutrientValue['code'],
	value: number,
	qualifier: NutrientValue['qualifier'] = 'reported'
): NutrientValue => ({ code, value, qualifier });
const label = [n('energy_kcal', 400), n('fat', 18), n('salt', 0.1, 'less_than'), n('protein', 6.5)];
const per100 = { basis: '100g', servingSize: null };

describe('scan edits', () => {
	it('counts nothing when the proposal is saved as it was', () => {
		expect(
			scanEdits({ ...per100, nutrients: label, basisKnown: true }, { ...per100, nutrients: label })
		).toEqual({
			proposed: 4,
			changed: 0,
			removed: 0,
			added: 0,
			basisKnown: true,
			basisChanged: false
		});
	});

	it('counts changed, removed and added values, and a changed "less than"', () => {
		const saved = [
			n('energy_kcal', 410), // changed number
			n('salt', 0.1), // no longer "less than"
			n('protein', 6.5),
			n('sugars', 24) // filled in
		];
		expect(
			scanEdits({ ...per100, nutrients: label, basisKnown: true }, { ...per100, nutrients: saved })
		).toMatchObject({ proposed: 4, changed: 2, removed: 1, added: 1, basisChanged: false });
	});

	it("treats the form's reported value as the same as a proposed estimate", () => {
		const proposal = [n('energy_kcal', 400, 'estimate')];
		expect(
			scanEdits(
				{ ...per100, nutrients: proposal, basisKnown: true },
				{ ...per100, nutrients: [n('energy_kcal', 400)] }
			).changed
		).toBe(0);
	});

	it('notices a changed basis or serving size, and an unknown proposed basis', () => {
		const serving = { basis: 'serving', servingSize: { amount: 30, unit: 'g' } };
		const base = { nutrients: label, basisKnown: true };
		expect(scanEdits({ ...serving, ...base }, { ...per100, nutrients: label }).basisChanged).toBe(
			true
		);
		expect(
			scanEdits(
				{ ...serving, ...base },
				{ basis: 'serving', servingSize: { amount: 25, unit: 'g' }, nutrients: label }
			).basisChanged
		).toBe(true);
		expect(
			scanEdits({ ...per100, nutrients: [], basisKnown: false }, { ...per100, nutrients: label })
		).toMatchObject({ proposed: 0, added: 4, basisKnown: false });
	});
});
