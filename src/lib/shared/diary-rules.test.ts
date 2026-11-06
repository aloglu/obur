import { describe, expect, it } from 'vitest';
import {
	addDays,
	anyValuesChanged,
	carbohydrateDay,
	dayTotals,
	isIsoDate,
	isLateNight,
	isValidZone,
	localDate,
	snapshotNutrients
} from './diary-rules.ts';
import type { FoodSnapshot } from './diary-types.ts';
import type { FoodDetail } from './food-types.ts';

const bread: FoodSnapshot = {
	name: 'Premium Light Ekmek',
	brand: 'Untad',
	basis: '100g',
	servingLabel: null,
	servingSize: null,
	servings: [{ id: 's1', name: 'slice', amount: 26, unit: 'g' }],
	basisNutrients: [
		{ code: 'energy_kcal', value: 193, qualifier: 'reported' },
		{ code: 'fat', value: 0.2, qualifier: 'reported' },
		{ code: 'fibre', value: 15, qualifier: 'reported' }
	]
};

describe('snapshotNutrients', () => {
	it('scales from the entry’s own snapshot by grams or by a stored portion', () => {
		expect(snapshotNutrients(bread, 50, { kind: 'mass', unit: 'g' })).toEqual({
			energy_kcal: { value: 96.5, qualifier: 'reported' },
			fat: { value: 0.1, qualifier: 'reported' },
			fibre: { value: 7.5, qualifier: 'reported' }
		});
		const slices = snapshotNutrients(bread, 3, {
			kind: 'serving',
			servingId: 's1',
			name: 'slice',
			amount: 26,
			unit: 'g'
		});
		expect(slices?.energy_kcal?.value).toBeCloseTo(150.54);
	});

	it('refuses a conversion the snapshot cannot support', () => {
		expect(
			snapshotNutrients(bread, 1, {
				kind: 'measure',
				code: 'su_bardagi',
				name: 'Su bardağı',
				ml: 200
			})
		).toBeUndefined();
		const perSlice: FoodSnapshot = {
			...bread,
			basis: 'serving',
			servingLabel: '1 slice',
			servings: []
		};
		expect(snapshotNutrients(perSlice, 2, { kind: 'basis_serving' })?.energy_kcal?.value).toBe(386);
		expect(snapshotNutrients(perSlice, 50, { kind: 'mass', unit: 'g' })).toBeUndefined();
	});
});

describe('dayTotals', () => {
	it('sums known values and counts unknowns instead of treating them as zero', () => {
		const totals = dayTotals([
			{
				nutrients: {
					energy_kcal: { value: 265, qualifier: 'reported' },
					fibre: { value: 2, qualifier: 'reported' }
				}
			},
			{ nutrients: { energy_kcal: { value: 300, qualifier: 'reported' } } }, // quick add: fibre unknown
			{
				nutrients: {
					energy_kcal: { value: 50, qualifier: 'reported' },
					sugars: { value: 0.5, qualifier: 'less_than' }
				}
			}
		]);
		expect(totals.energy_kcal).toEqual({ value: 615, unknown: 0, approximate: false });
		expect(totals.fibre).toEqual({ value: 2, unknown: 2, approximate: false });
		expect(totals.sugars).toEqual({ value: 0.5, unknown: 2, approximate: true });
		expect(totals.protein).toBeUndefined();
	});

	it('returns nothing for an empty day', () => {
		expect(dayTotals([])).toEqual({});
	});
});

describe('days and zones', () => {
	it('computes the local day in the person’s zone', () => {
		const instant = new Date('2026-10-25T21:30:00Z');
		expect(localDate(instant, 'Europe/Istanbul')).toBe('2026-10-26');
		expect(localDate(instant, 'America/New_York')).toBe('2026-10-25');
	});

	it('adds days across month, year and daylight-saving boundaries', () => {
		expect(addDays('2026-10-31', 1)).toBe('2026-11-01');
		expect(addDays('2026-01-01', -1)).toBe('2025-12-31');
		expect(addDays('2026-03-29', 1)).toBe('2026-03-30');
		expect(addDays('2028-02-28', 1)).toBe('2028-02-29');
	});

	it('offers the previous day only before 04:00 local time', () => {
		expect(isLateNight(new Date('2026-10-25T00:30:00Z'), 'Europe/Istanbul')).toBe(true); // 03:30
		expect(isLateNight(new Date('2026-10-25T01:00:00Z'), 'Europe/Istanbul')).toBe(false); // 04:00
		expect(isLateNight(new Date('2026-10-25T12:00:00Z'), 'Europe/Istanbul')).toBe(false);
	});

	it('validates zones and dates', () => {
		expect(isValidZone('Europe/Istanbul')).toBe(true);
		expect(isValidZone('UTC')).toBe(true);
		expect(isValidZone('Mars/Olympus')).toBe(false);
		expect(isValidZone("Europe/Istanbul'; drop")).toBe(false);
		expect(isIsoDate('2026-10-25')).toBe(true);
		expect(isIsoDate('2026-02-29')).toBe(false);
		expect(isIsoDate('2026-10-5')).toBe(false);
	});
});

describe('carbohydrateDay', () => {
	const v = (value: number, qualifier: 'reported' | 'estimate' = 'reported') => ({
		value,
		qualifier
	});
	it('keeps the stated and the unstated carbohydrate apart and counts entries with neither', () => {
		const day = carbohydrateDay([
			{ nutrients: { carbohydrate_excl_fibre: v(20) } },
			{ nutrients: { carbohydrate_unspecified: v(30, 'estimate') } },
			{ nutrients: { carbohydrate_unspecified: v(12.5) } },
			// An entry with both counts only once, as the stated value.
			{ nutrients: { carbohydrate_excl_fibre: v(5), carbohydrate_unspecified: v(6) } },
			{ nutrients: { energy_kcal: v(100) } }
		]);
		expect(day).toEqual({
			stated: { value: 25, entries: 2, approximate: false },
			unstated: { value: 42.5, entries: 2, approximate: true },
			unknown: 1
		});
	});
});

describe('anyValuesChanged', () => {
	const food = (kcal: number, servings: FoodDetail['servings'] = []) =>
		({
			id: 'f1',
			name: 'Peynir',
			brand: null,
			basis: '100g',
			servingLabel: null,
			servingSize: null,
			servings,
			icon: null,
			nutrients: [{ code: 'energy_kcal', value: kcal, qualifier: 'reported' }]
		}) as unknown as FoodDetail;
	const item = {
		foodId: 'f1',
		amount: 50,
		unit: { kind: 'mass', unit: 'g' } as const,
		nutrients: { energy_kcal: { value: 125, qualifier: 'reported' as const } }
	};

	it('is false while the food still comes to the same values', () => {
		expect(anyValuesChanged([item], [food(250)])).toBe(false);
	});
	it('is true once it would come to different values', () => {
		expect(anyValuesChanged([item], [food(300)])).toBe(true);
	});
	it('ignores items that would keep their snapshot: food gone, or a calories-only item', () => {
		expect(anyValuesChanged([item], [])).toBe(false);
		expect(
			anyValuesChanged([{ foodId: null, amount: null, unit: null, nutrients: {} }], [food(300)])
		).toBe(false);
	});
	it('ignores an item whose serving no longer exists', () => {
		const unit = {
			kind: 'serving',
			servingId: 's1',
			name: 'dilim',
			amount: 30,
			unit: 'g'
		} as const;
		expect(anyValuesChanged([{ ...item, unit }], [food(300)])).toBe(false);
	});
});
