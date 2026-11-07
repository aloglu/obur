// Label parser cases on made-up labels (private photos and their text stay out of the repository). Development
// accuracy on real labels is measured with scripts/label-eval.ts and recorded in docs/feasibility.md.
import { describe, expect, it } from 'vitest';
import { parseLabel, type OcrLine } from './parse.ts';

/** An OCR line at (x, y), its width from its length unless given; `dy` tilts its right end. */
const line = (text: string, x: number, y: number, w = text.length * 8, dy = 0): OcrLine => ({
	text,
	box: [
		[x, y],
		[x + w, y + dy],
		[x + w, y + 20 + dy],
		[x, y + 20]
	],
	score: 0.95
});

const value = (p: ReturnType<typeof parseLabel>, code: string) =>
	p.nutrients.find((n) => n.code === code);

/** A Turkish table: per 100 g, per serving (25 g) and %RI columns, a title above and a footnote below. */
function table(rows: [string, string, string, string][], drift = 0): OcrLine[] {
	const out = [
		line('Enerji ve', 100, 60),
		line('Besin Öğeleri', 100, 82),
		line('100 g', 300, 60, 50),
		line('için', 300, 82, 40),
		line('1 porsiyon', 400, 60, 80),
		line('için (25 g)', 400, 82, 80),
		line('%RA*', 520, 70, 40)
	];
	rows.forEach(([name, per100, serving, ri], i) => {
		const y = 120 + i * 26;
		out.push(line(name, 100, y), line(per100, 300, y + drift * i, 60));
		out.push(line(serving, 400, y + drift * i, 60), line(ri, 520, y + drift * i, 40));
	});
	out.push(
		line(
			'*Değerler ortalama bir yetişkinin Referans Alım Düzeyini belirtir (8400 kJ/2000 kcal)',
			100,
			340,
			500
		)
	);
	return out;
}

const ROWS: [string, string, string, string][] = [
	['Enerji (kJ ve kcal)', '1098/265', '275/66', '%13'],
	['Yağ (g)', '21,5', '5,4', '%31'],
	['- Doymuş yağ (g)', '14,0', '3,5', '%70'],
	['Karbonhidrat (g)', '1,3', '0,3', '9628'],
	['-Şekerler (g)', '<0,5', '<0,1', '%1'],
	['Protein (g)', '16,5', '4,1', '%33'],
	['Tuz (g)', '1,2', '0,3', '%20']
];

describe('tables', () => {
	it('reads the per-100 column, energy in both units, bounds, and offers the serving as a portion', () => {
		const p = parseLabel(table(ROWS));
		expect(p).toMatchObject({
			layout: 'table',
			basis: '100g',
			portion: { name: 'porsiyon', amount: 25, unit: 'g' }
		});
		expect(value(p, 'energy_kj')?.value).toBe(1098);
		expect(value(p, 'energy_kcal')?.value).toBe(265);
		expect(value(p, 'saturated_fat')?.value).toBe(14);
		expect(value(p, 'fat')?.value).toBe(21.5);
		expect(value(p, 'sugars')).toEqual({ code: 'sugars', value: 0.5, qualifier: 'less_than' });
		expect(value(p, 'salt')?.value).toBe(1.2);
	});

	it('never takes a %RI value, even one the OCR misread without its % sign', () => {
		const p = parseLabel(table(ROWS));
		expect(value(p, 'carbohydrate_excl_fibre')?.value).toBe(1.3);
		expect(p.nutrients.some((n) => n.value === 9628 || n.value === 13)).toBe(false);
	});

	it('follows values that drift lower row by row on a curved pack', () => {
		// 4 px a row: by protein the value is nearer the salt row than its own; the drift is followed.
		const p = parseLabel(table(ROWS, 4));
		expect(value(p, 'protein')?.value).toBe(16.5);
		expect(value(p, 'salt')?.value).toBe(1.2);
	});

	it('leaves a value the OCR missed unknown, and drops impossible numbers instead of proposing them', () => {
		const rows = ROWS.map((r) => [...r] as [string, string, string, string]);
		rows[1][1] = '';
		rows[4][1] = '55827750';
		const p = parseLabel(table(rows).filter((l) => l.text !== ''));
		expect(value(p, 'fat')).toBeUndefined();
		expect(value(p, 'sugars')).toBeUndefined();
		expect(value(p, 'protein')?.value).toBe(16.5);
	});

	it('tolerates a one-letter OCR slip in a row name', () => {
		const rows = ROWS.map((r) => [...r] as [string, string, string, string]);
		rows[4][0] = '-Sekerier (g)';
		expect(value(parseLabel(table(rows)), 'sugars')?.value).toBe(0.5);
	});

	it('reads values on the name line in a bilingual table, and per 100 ml', () => {
		const p = parseLabel([
			line('100 ml için / Per 100 ml', 300, 40, 180),
			line('Enerji/Energy (kJ/kcal)', 100, 80),
			line('180/43', 300, 80, 50),
			line('Yağ/Fat 0g', 100, 106),
			line('Karbonhidrat/Carbohydrate 10,6g', 100, 132, 260),
			line('Şekerler/Sugars 10,6g', 100, 158, 180),
			line('Protein/Protein 0g', 100, 184),
			line('Tuz/Salt 0,01g', 100, 210)
		]);
		expect(p).toMatchObject({ basis: '100ml', layout: 'table' });
		expect(value(p, 'energy_kcal')?.value).toBe(43);
		expect(value(p, 'carbohydrate_excl_fibre')?.value).toBe(10.6);
		expect(value(p, 'fat')?.value).toBe(0);
		expect(value(p, 'salt')?.value).toBe(0.01);
	});
});

describe('layouts seen in held-out photos', () => {
	/** A one-column table: names at x 100, values at x 300, rows 26 px apart from y 120. */
	const simple = (rows: [string, string][], title = "Enerji ve Besin Öğeleri (100g'da)") => [
		line(title, 100, 80, 300),
		...rows.flatMap(([name, value], i) => [
			line(name, 100, 120 + i * 26),
			line(value, 300, 120 + i * 26, 60)
		])
	];

	it('takes the basis from the title, and reads energy written kcal first with its units', () => {
		const p = parseLabel(
			simple([
				['Enerji', '92,2 kcal/389,6 kj'],
				['Yağ', '1,8g'],
				['Karbonhidrat', '2g'],
				['Protein', '17g']
			])
		);
		expect(p.basis).toBe('100g');
		expect(value(p, 'energy_kcal')?.value).toBe(92.2);
		expect(value(p, 'energy_kj')?.value).toBe(389.6);
	});

	it('keeps energy on two lines on the energy row, and the next rows in place', () => {
		const p = parseLabel([
			line('100 g için', 300, 80, 80),
			line('Enerji', 100, 120),
			line('1358 kJ', 300, 118, 60),
			line('338 kcal', 300, 136, 60),
			line('Yağ', 100, 160),
			line('2.1 g', 300, 160, 50),
			line('Doymuş Yağ', 100, 186),
			line('0.39 g', 300, 186, 50),
			line('Karbonhidrat', 100, 212),
			line('59 g', 300, 212, 50)
		]);
		expect(value(p, 'energy_kj')?.value).toBe(1358);
		expect(value(p, 'energy_kcal')?.value).toBe(338);
		expect(value(p, 'fat')?.value).toBe(2.1);
		expect(value(p, 'saturated_fat')?.value).toBe(0.39);
		expect(value(p, 'carbohydrate_excl_fibre')?.value).toBe(59);
	});

	it('ignores per-portion badges beside the table and stray numbers in the names column', () => {
		const p = parseLabel([
			...simple([
				['Enerji (kJ/kcal)', '1266/298'],
				['Yağ (g)', '<0,5'],
				['Karbonhidrat (g)', '69'],
				['-Şekerler (g)', '42'],
				['Protein (g)', '2,5']
			]),
			line('DOYMUŞ', 0, 120, 50),
			line('0,23g', 0, 140, 40),
			line('PROTEIN', 0, 190, 50),
			line('6,72g', 0, 210, 40),
			line('24', 104, 200, 16)
		]);
		expect(value(p, 'saturated_fat')).toBeUndefined();
		expect(value(p, 'sugars')?.value).toBe(42);
		expect(value(p, 'protein')?.value).toBe(2.5);
	});

	it('gives a misread row name its own numbers instead of passing them on', () => {
		const p = parseLabel(
			simple([
				['Enerji (kJ/kcal)', '1358/338'],
				['Şeker', '2.6 g'],
				['Jif', '10.9 g'],
				['Protein', '11.2 g'],
				['Tuz', '0.07 g']
			])
		);
		expect(value(p, 'protein')?.value).toBe(11.2);
		expect(value(p, 'fibre')).toBeUndefined();
		expect(p.nutrients.some((n) => n.value === 10.9)).toBe(false);
	});

	it('reads German sub-rows ("davon …") and Eiweiß, with a name over two lines', () => {
		const p = parseLabel([
			line('pro 100 g', 300, 80, 80),
			line('Energie', 100, 120),
			line('292 kJ', 300, 120, 50),
			line('68 kcal', 300, 140, 50),
			line('Fett', 100, 164),
			line('0,1 g', 300, 172, 40),
			line('davon gesättigte', 100, 188),
			line('Fettsäuren', 100, 206),
			line('0 g', 300, 208, 30),
			line('Kohlenhydrate', 100, 232),
			line('6,5 g', 300, 232, 40),
			line('davon Zucker', 100, 252),
			line('3,5 g', 300, 252, 40),
			line('Eiweiß', 100, 278),
			line('9,8 g', 300, 278, 40),
			line('Salz', 100, 304),
			line('18,2 g', 300, 304, 40)
		]);
		expect(p.basis).toBe('100g');
		expect(value(p, 'fat')?.value).toBe(0.1);
		expect(value(p, 'saturated_fat')?.value).toBe(0);
		expect(value(p, 'sugars')?.value).toBe(3.5);
		expect(value(p, 'protein')?.value).toBe(9.8);
		expect(value(p, 'salt')?.value).toBe(18.2);
	});

	it('never takes a "(g)" the OCR read as "(9)" for a value', () => {
		const p = parseLabel(
			simple([
				['Enerji (kJ/kcal)', '608/144'],
				['Yağ (9)', ''],
				['Karbonhidrat (9)', ''],
				['Protein (9)', '']
			]).filter((l) => l.text !== '')
		);
		expect(p.nutrients.some((n) => n.value === 9)).toBe(false);
		expect(value(p, 'energy_kcal')?.value).toBe(144);
	});
});

describe('running text', () => {
	it('reads the first basis only, after the ingredients, telling saturated fat from fat', () => {
		const p = parseLabel([
			line('İçindekiler: hindi eti, tuz, sodyum polifosfat.', 20, 40, 500),
			line(
				'Enerji ve Besin Öğeleri (100 g için): Enerji (kJ/kcal) 360/85 - %4 · Yağ (g) 1,0 - %1 · Doymuş',
				20,
				66,
				700
			),
			line(
				'Yağ (g) 0,3 - %2 · Karbonhidrat (g) 2,0 · Şekerler (g) 0 · Protein (g) 17,0 · Tuz (g) 1,7',
				20,
				92,
				700
			),
			line(
				'(1 porsiyon için (30 g)): Enerji (kJ/kcal) 108/26 · Yağ (g) 0,3 · Protein (g) 5,1 · Tuz (g) 0,5',
				20,
				118,
				700
			)
		]);
		expect(p).toMatchObject({ layout: 'text', basis: '100g' });
		expect(value(p, 'energy_kcal')?.value).toBe(85);
		expect(value(p, 'fat')?.value).toBe(1);
		expect(value(p, 'saturated_fat')?.value).toBe(0.3);
		expect(value(p, 'protein')?.value).toBe(17);
		expect(value(p, 'salt')?.value).toBe(1.7);
		expect(value(p, 'sodium')).toBeUndefined();
	});

	it('reads bilingual running text', () => {
		const p = parseLabel([
			line('Energy and Nutrients / Enerji ve Besin Öğeleri (100g)', 20, 40, 500),
			line('Energy / Enerji (kJ/kcal): 153/37 - Fat / Yağ: 0,5 g', 20, 66, 500),
			line('Saturated Fat/Doymuş Yağ: 0,3 g - Carbohydrates/', 20, 92, 500),
			line('Karbonhidrat: 7 g - Sugars/Şekerler: 3,6g', 20, 118, 500)
		]);
		expect(p.basis).toBe('100g');
		expect(value(p, 'fat')?.value).toBe(0.5);
		expect(value(p, 'saturated_fat')?.value).toBe(0.3);
		expect(value(p, 'carbohydrate_excl_fibre')?.value).toBe(7);
		expect(value(p, 'sugars')?.value).toBe(3.6);
	});
});

describe('notes on what was decided', () => {
	it('says which column was read, what was skipped and that the serving became a portion', () => {
		expect(parseLabel(table(ROWS)).notes).toEqual([
			{ kind: 'columns', used: '100g', skippedServing: true, skippedRi: true, portion: true }
		]);
	});

	it('names values left out as impossible, and not ones simply missing', () => {
		const rows = ROWS.map((r) => [...r] as [string, string, string, string]);
		rows[1][1] = '';
		rows[4][1] = '55827750';
		const p = parseLabel(table(rows).filter((l) => l.text !== ''));
		expect(p.notes).toContainEqual({ kind: 'dropped', codes: ['sugars'] });
	});

	it('says when the basis came from the title, and when salt was written in mg', () => {
		const p = parseLabel([
			line("Enerji ve Besin Öğeleri (100g'da)", 100, 80, 300),
			...[
				['Enerji', '92 kcal'],
				['Yağ', '1,8g'],
				['Protein', '17g'],
				['Tuz', '450 mg']
			].flatMap(([name, v], i) => [line(name, 100, 120 + i * 26), line(v, 300, 120 + i * 26, 60)])
		]);
		expect(value(p, 'salt')?.value).toBe(0.45);
		expect(p.notes).toEqual([
			{ kind: 'basis_from_title', basis: '100g' },
			{ kind: 'converted_mg', codes: ['salt'] }
		]);
	});

	it('says when it read running text, and has nothing to say about nothing', () => {
		const text = parseLabel([
			line('Enerji ve Besin Öğeleri (100g)', 20, 40, 500),
			line('Enerji (kJ/kcal): 153/37 - Yağ: 0,5 g', 20, 66, 500),
			line('Karbonhidrat: 7 g - Şekerler: 3,6g - Protein: 1 g', 20, 92, 500)
		]);
		expect(text.notes).toEqual([{ kind: 'running_text' }]);
		expect(parseLabel([line('Net Miktar: 400 g', 20, 40)]).notes).toEqual([]);
	});
});

it('proposes nothing when there is no nutrition information', () => {
	const p = parseLabel([line('Net Miktar: 400 g', 20, 40), line('TETT 01/06/2027', 20, 70)]);
	expect(p).toMatchObject({ layout: 'none', basis: null, nutrients: [] });
});
