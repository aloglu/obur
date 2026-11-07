// A table as a remote model copies it, read by the same rules as the local OCR's lines.
import { describe, expect, it } from 'vitest';
import { parseLabelTable, type LabelTable } from './table.ts';

const value = (p: ReturnType<typeof parseLabelTable>, code: string) =>
	p.nutrients.find((n) => n.code === code);

const TABLE: LabelTable = {
	title: 'Nutrition information',
	columns: ['per 100 g', 'per serving (30 g)', '%RI*'],
	rows: [
		{ name: 'Energy', values: ['1673 kJ / 400 kcal', '502 kJ / 120 kcal', '20%'] },
		{ name: 'Fat', values: ['18 g', '5,4 g', '26%'] },
		{ name: 'of which saturates', values: ['2,5 g', '0,8 g', '13%'] },
		{ name: 'Carbohydrate', values: ['52 g', '15,6 g', '20%'] },
		{ name: 'of which sugars', values: ['24 g', '7,2 g', '27%'] },
		{ name: 'Protein', values: ['6,5 g', '2 g', '13%'] },
		{ name: 'Salt', values: ['<0,1 g', '<0,1 g', '1%'] }
	]
};

describe('a copied table', () => {
	it('reads the per-100 g column with decimal commas and bounds, skips per serving and %RI, offers the portion', () => {
		const p = parseLabelTable(TABLE);
		expect(p.basis).toBe('100g');
		expect(p.layout).toBe('table');
		expect(value(p, 'energy_kcal')?.value).toBe(400);
		expect(value(p, 'energy_kj')?.value).toBe(1673);
		expect(value(p, 'saturated_fat')?.value).toBe(2.5);
		expect(value(p, 'protein')?.value).toBe(6.5);
		expect(value(p, 'salt')).toMatchObject({ value: 0.1, qualifier: 'less_than' });
		expect(p.portion).toMatchObject({ amount: 30, unit: 'g' });
		expect(p.notes).toContainEqual(
			expect.objectContaining({
				kind: 'columns',
				used: '100g',
				skippedServing: true,
				skippedRi: true
			})
		);
		expect(p.warnings).toEqual([]);
	});

	it('leaves unreadable cells unknown, and warns when the copied numbers don’t add up', () => {
		const rows = TABLE.rows.map((r) => ({ ...r, values: [...r.values] }));
		rows[1].values[0] = null; // fat unreadable
		rows[5].values[0] = '25 g'; // "2,5" copied as "25"
		const p = parseLabelTable({ ...TABLE, rows });
		expect(value(p, 'fat')).toBeUndefined();
		// Dried apricots: protein printed "2,5 g" but copied as "25 g".
		const withFat = parseLabelTable({
			title: null,
			columns: ['per 100 g'],
			rows: [
				{ name: 'Energy', values: ['1266 kJ / 298 kcal'] },
				{ name: 'Fat', values: ['<0,5 g'] },
				{ name: 'Carbohydrate', values: ['69 g'] },
				{ name: 'Protein', values: ['25 g'] }
			]
		});
		expect(withFat.warnings).toContain('energy_macros_mismatch');
	});

	it('drops values no food can have, and proposes nothing for an empty answer', () => {
		const rows = TABLE.rows.map((r) =>
			r.name === 'of which sugars' ? { ...r, values: ['240 g', '72 g', '27%'] } : r
		);
		expect(parseLabelTable({ ...TABLE, rows }).notes).toContainEqual({
			kind: 'dropped',
			codes: ['sugars']
		});
		expect(parseLabelTable({ title: null, columns: [], rows: [] })).toMatchObject({
			layout: 'none',
			nutrients: []
		});
	});

	it('takes the basis from the title when the only column says nothing', () => {
		const p = parseLabelTable({
			title: 'Nutrition information per 100 ml',
			columns: [''],
			rows: [
				{ name: 'Energy', values: ['180 kJ / 43 kcal'] },
				{ name: 'Fat', values: ['0 g'] },
				{ name: 'Carbohydrate', values: ['10,6 g'] },
				{ name: 'Protein', values: ['0 g'] }
			]
		});
		expect(p.basis).toBe('100ml');
		expect(value(p, 'carbohydrate_excl_fibre')?.value).toBe(10.6);
	});
});
