// Nutrition label parser (docs/design.md, "OCR and barcode capture"): OCR lines with positions in, a proposal out.
// Pure: no I/O. It proposes values for a person to confirm and never invents one; anything it can't read stays
// unknown. Two layouts: a table (rows of nutrient names, columns per 100 g/ml, per serving and %RI) and running
// text ("Energy (kJ/kcal): 153/37 - Fat: 0,5 g ..."). Plausibility warnings come from the shared food checks.
import { foodWarnings, type FoodWarning } from '../../../shared/food-checks.ts';
import type { LabelNote } from '../../../shared/label-notes.ts';
import type { NutrientCode, NutrientValue } from '../../../shared/nutrients.ts';

export type { LabelNote };

export interface OcrLine {
	text: string;
	/** Four corners, clockwise from top left, in image pixels. */
	box: [number, number][];
	score: number;
}

export interface LabelProposal {
	/** The column the values come from; null when no basis could be read. */
	basis: '100g' | '100ml' | 'serving' | null;
	/** A per-serving column's name and size, offered as a portion ("porsiyon", 25 g). */
	portion: { name: string; amount: number; unit: 'g' | 'ml' } | null;
	nutrients: NutrientValue[];
	layout: 'table' | 'text' | 'none';
	warnings: FoodWarning[];
	/** What was decided while reading, for the person checking it ("the %RI column was skipped"). */
	notes: LabelNote[];
}

/** Choices made while reading, collected as they happen. */
interface Seen {
	dropped: NutrientCode[];
	milligrams: NutrientCode[];
	/** Values whose numbers the OCR read with low confidence. */
	unclear: NutrientCode[];
}

type Code = Extract<
	NutrientCode,
	| 'energy_kcal'
	| 'fat'
	| 'saturated_fat'
	| 'carbohydrate_excl_fibre'
	| 'sugars'
	| 'fibre'
	| 'protein'
	| 'salt'
	| 'sodium'
>;
/** 'other': a name-column line that is no nutrient we read (a misread name, vitamins); it keeps its numbers. */
type Row = Code | 'energy' | 'other';

/** Row names, folded (lower case, no diacritics). More specific names first: "doymus yag" before "yag". */
const NAMES: [Row, string[]][] = [
	[
		'saturated_fat',
		[
			'doymus yag asitleri',
			'doymus yag',
			'doymus',
			'saturated fat',
			'saturates',
			'of which saturates',
			'gesattigte fettsauren',
			'gesattigte'
		]
	],
	['sugars', ['sekerler', 'seker', 'sugars', 'sugar', 'zucker']],
	['fibre', ['diyet lifi', 'lif', 'fibre', 'fiber', 'ballaststoffe']],
	['carbohydrate_excl_fibre', ['karbonhidrat', 'carbohydrates', 'carbohydrate', 'kohlenhydrate']],
	['protein', ['protein', 'proteins', 'eiweiss']],
	['salt', ['tuz', 'salt', 'salz']],
	['sodium', ['sodyum', 'sodium']],
	['fat', ['toplam yag', 'yag', 'fat', 'fett']],
	['energy', ['enerji', 'energy', 'energie']]
];

/** Lower case with Turkish dotted and dotless i, diacritics removed; digits and punctuation kept. */
export function fold(text: string): string {
	return text
		.normalize('NFC')
		.replace(/[İIı]/g, 'i')
		.toLowerCase()
		.replace(/ß/g, 'ss')
		.normalize('NFD')
		.replace(/\p{M}+/gu, '');
}

function distance(a: string, b: string): number {
	const d = Array.from({ length: b.length + 1 }, (_, j) => j);
	for (let i = 1; i <= a.length; i++) {
		let prev = d[0];
		d[0] = i;
		for (let j = 1; j <= b.length; j++) {
			const t = d[j];
			d[j] = Math.min(d[j] + 1, d[j - 1] + 1, prev + (a[i - 1] === b[j - 1] ? 0 : 1));
			prev = t;
		}
	}
	return d[b.length];
}

/** OCR slips allowed in a name: none for short names, one for five letters or more, two from nine. */
const allowed = (name: string) => (name.length >= 9 ? 2 : name.length >= 5 ? 1 : 0);

/** The row a text starts with (after dashes and bullets), and where the name ends; undefined if none. */
function rowAt(text: string): { row: Row; end: number } | undefined {
	// Leading dashes and bullets, and "of which" sub-row words ("davon Zucker", "bunlardan şekerler").
	const m = /^[\s\-–•·*.]*(?:(?:davon|of which|bunlardan|dont)\s+)?/.exec(text)!;
	const rest = text.slice(m[0].length);
	for (const [row, names] of NAMES) {
		for (const name of names) {
			// Compare the same number of letters, so "sekerierr (g)" can match "sekerler".
			const head = rest.slice(0, name.length);
			const next = rest[name.length] ?? ' ';
			// The name must end the word: "Fett" is not "Fettsäuren".
			if (/\p{L}/u.test(next)) continue;
			if (distance(head, name) <= allowed(name)) return { row, end: m[0].length + name.length };
		}
	}
	return undefined;
}

/** A row name at the start of a line, or after a slash in a bilingual one ("Selede / Sugars (g)"). */
function rowName(text: string): { row: Row; end: number } | undefined {
	const first = rowAt(text);
	if (first) return first;
	const head = text.split(/\d/)[0];
	for (let i = head.indexOf('/'); i >= 0; i = head.indexOf('/', i + 1)) {
		const hit = rowAt(text.slice(i + 1));
		if (hit) return { row: hit.row, end: i + 1 + hit.end };
	}
	return undefined;
}

/** Headers and footnotes that name nutrients but are not rows. */
const NOT_A_ROW = /besin ogeleri|nutrition|referans|reference|ortalama|bilinen|8400/;

interface Num {
	value: number;
	/** A second value after a slash (kJ/kcal). */
	second: number | null;
	lessThan: boolean;
	unit: 'kj' | 'kcal' | 'mg' | 'g' | 'ml' | null;
	/** The units written after each of two values ("92,2 kcal/389,6 kj"). */
	units: [string | null, string | null];
	percent: boolean;
	/** Horizontal position in the image. */
	x: number;
	/** The OCR's confidence in the line it came from. */
	score: number;
}

const NUMBER =
	/(%\s*)?([<≤]\s*)?(\d+(?:[.,]\d+)?)(?:\s*(kj|kcal))?(?:\s*\/\s*(\d+(?:[.,]\d+)?))?\s*(kj|kcal|mg|g|ml)?(?![\p{L}\d])(\s*%)?/giu;

/** Numbers in a text; `x0`/`x1` place each one along the line in proportion to its characters. */
function numbers(text: string, x0 = 0, x1 = 0, score = 1): Num[] {
	const out: Num[] = [];
	for (const m of fold(text).matchAll(NUMBER)) {
		const unit = (m[6] ?? m[4] ?? null) as Num['unit'];
		const at = (m.index! + m[0].length / 2) / Math.max(text.length, 1);
		out.push({
			value: Number(m[3].replace(',', '.')),
			second: m[5] ? Number(m[5].replace(',', '.')) : null,
			lessThan: !!m[2],
			unit: m[4] && m[6] ? null : unit,
			units: [m[4] ?? null, m[5] ? (m[6] ?? null) : null],
			// "1,4g %2": a number with a unit is an amount; the % belongs to the next number.
			percent: !!m[1] || (!!m[7] && !unit),
			x: x0 + (x1 - x0) * at,
			score
		});
	}
	return out;
}

interface Line {
	text: string;
	folded: string;
	x0: number;
	x1: number;
	cx: number;
	cy: number;
	h: number;
	score: number;
}

function toLine(l: OcrLine): Line {
	const xs = l.box.map((p) => p[0]);
	const ys = l.box.map((p) => p[1]);
	const x0 = Math.min(...xs);
	const x1 = Math.max(...xs);
	return {
		text: l.text,
		folded: fold(l.text),
		x0,
		x1,
		cx: (x0 + x1) / 2,
		cy: ys.reduce((a, b) => a + b, 0) / ys.length,
		h: Math.max(...ys) - Math.min(...ys),
		score: l.score
	};
}

type Column =
	| { kind: 'per100'; unit: 'g' | 'ml'; x: number; portion: LabelProposal['portion'] }
	| { kind: 'serving'; x: number; portion: LabelProposal['portion'] }
	| { kind: 'ri'; x: number };

const RI = /%\s*r[ai]|r\.?\s*a\.?\s*[*'"]|%\s*(brd|nrv|gda|gbm)|\bri\b|\bra\b\*/;
const PER100 = /100\s*(g|ml)\b|100\s*(g|ml)(?=\s*(icin|için))|100(g|ml)/;
const SERVING = /porsiyon|portion|serving|kutu|dilim|tuketim birim|paket|bardak|adet/;

/** A per-serving header's name and size: "1 porsiyon için (25 g)" → porsiyon, 25 g. */
function portionOf(text: string): LabelProposal['portion'] {
	const name = /(porsiyon|portion|serving|kutu|dilim|paket|bardak|adet)/.exec(text)?.[1];
	const size = /\(?\s*(\d+(?:[.,]\d+)?)\s*(g|ml)\s*\)?/.exec(text.replace(/100\s*(g|ml)/g, ''));
	if (!name || !size) return null;
	return { name, amount: Number(size[1].replace(',', '.')), unit: size[2] as 'g' | 'ml' };
}

/** Header columns above the first row: lines stacked in one column are read together. */
function headerColumns(lines: Line[], top: number, rowGap: number): Column[] {
	const near = (a: Line, b: Line) =>
		Math.min(a.x1, b.x1) - Math.max(a.x0, b.x0) > 0.4 * Math.min(a.x1 - a.x0, b.x1 - b.x0);
	const all = lines.filter((l) => l.cy < top && l.cy > top - rowGap * 4.5 && !rowAt(l.folded));
	// A line over two separate headers is a sentence ("1 paket … 19 tüketim birimidir"), not a header.
	const zone = all.filter(
		(l) =>
			!all.some(
				(a) =>
					a !== l && near(a, l) && all.some((b) => b !== l && b !== a && near(b, l) && !near(a, b))
			)
	);
	const groups: Line[][] = [];
	for (const l of zone.sort((a, b) => a.cx - b.cx)) {
		const g = groups.find((gr) => gr.some((o) => near(o, l)));
		if (g) g.push(l);
		else groups.push([l]);
	}
	const columns: Column[] = [];
	for (const g of groups) {
		const text = g
			.sort((a, b) => a.cy - b.cy)
			.map((l) => l.folded)
			.join(' ');
		const x = g.reduce((s, l) => s + l.cx, 0) / g.length;
		// A header naming 100 g is the per-100 column even if it also states a serving size.
		if (RI.test(text)) columns.push({ kind: 'ri', x });
		else if (PER100.test(text))
			columns.push({
				kind: 'per100',
				unit: /100\s*ml/.test(text) ? 'ml' : 'g',
				x,
				portion: SERVING.test(text) ? portionOf(text) : null
			});
		else if (SERVING.test(text)) columns.push({ kind: 'serving', x, portion: portionOf(text) });
	}
	return columns;
}

/** OCR confidence below which a value's number is called hard to read (docs/feasibility.md, "Unflagged misreads"). */
const UNCLEAR_BELOW = 0.9;

const round = (n: number) => Math.round(n * 10_000) / 10_000;

/** Energy from the numbers of its row: "1098/265" in the label's stated order, or values with their units. */
function energy(nums: Num[], label: string): NutrientValue[] {
	const out: NutrientValue[] = [];
	const kjFirst = !/kcal\s*(ve|\/|and)\s*k/.test(label);
	for (const n of nums) {
		const q = n.lessThan ? ('less_than' as const) : ('reported' as const);
		if (n.second !== null) {
			// Units written beside the values decide; otherwise the row label's order (kJ first by default).
			const first =
				n.units[0] === 'kcal' || n.units[1] === 'kj'
					? 'kcal'
					: n.units[0] === 'kj' || n.units[1] === 'kcal'
						? 'kj'
						: kjFirst
							? 'kj'
							: 'kcal';
			const [kj, kcal] = first === 'kj' ? [n.value, n.second] : [n.second, n.value];
			out.push(
				{ code: 'energy_kj', value: kj, qualifier: q },
				{ code: 'energy_kcal', value: kcal, qualifier: q }
			);
			return out;
		}
		if (n.unit === 'kj') out.push({ code: 'energy_kj', value: n.value, qualifier: q });
		else if (n.unit === 'kcal') out.push({ code: 'energy_kcal', value: n.value, qualifier: q });
		else if (/kcal/.test(label) && !/kj/.test(label))
			out.push({ code: 'energy_kcal', value: n.value, qualifier: q });
		else if (/kj/.test(label) && !/kcal/.test(label))
			out.push({ code: 'energy_kj', value: n.value, qualifier: q });
		if (out.some((v) => v.code === 'energy_kj') && out.some((v) => v.code === 'energy_kcal')) break;
	}
	return out;
}

/** A row's value from one number: grams, with milligrams of salt or sodium converted (stated units only). */
function amount(row: Code, n: Num, seen: Seen): NutrientValue {
	const milligrams = n.unit === 'mg' && (row === 'salt' || row === 'sodium');
	if (milligrams) seen.milligrams.push(row);
	const value = milligrams ? round(n.value / 1000) : n.value;
	return { code: row, value, qualifier: n.lessThan ? 'less_than' : 'reported' };
}

/** Values no food can have per 100 g or ml (a phone number, a misread %): dropped, so they stay unknown. */
function possible(v: NutrientValue, per100: boolean): boolean {
	if (v.code === 'energy_kcal') return v.value <= (per100 ? 900 : 5000);
	if (v.code === 'energy_kj') return v.value <= (per100 ? 3800 : 21000);
	return per100 ? v.value <= 100 : v.value <= 1000;
}

function add(out: Map<string, NutrientValue>, values: NutrientValue[], seen: Seen, per100 = true) {
	for (const v of values) {
		if (out.has(v.code)) continue;
		if (possible(v, per100)) out.set(v.code, v);
		else seen.dropped.push(v.code);
	}
}

type Read = Omit<LabelProposal, 'warnings' | 'notes'> & { notes: LabelNote[] };

function parseTable(lines: Line[], seen: Seen): Read | undefined {
	let labels = lines
		.map((l) => ({ line: l, hit: NOT_A_ROW.test(l.folded) ? undefined : rowName(l.folded) }))
		.filter((r): r is { line: Line; hit: { row: Row; end: number } } => !!r.hit)
		// "Enerji ve / Besin Öğeleri" is the table's title, not its energy row.
		.filter(
			(r) => !(r.hit.row === 'energy' && /^\s*(ve|ye|and|&)\b/.test(r.line.folded.slice(r.hit.end)))
		)
		.sort((a, b) => a.line.cy - b.line.cy);
	if (labels.length < 3) return undefined;
	// Row names in a table share one left edge (sub-rows indent a little); names off to the side, such as
	// per-portion badges beside the table, are not rows.
	const reach = Math.max(
		40,
		2.5 * ([...labels.map((r) => r.line.h)].sort((a, b) => a - b)[labels.length >> 1] || 16)
	);
	const edge = labels
		.map((r) => r.line.x0)
		.reduce((best, x) =>
			labels.filter((o) => Math.abs(o.line.x0 - x) <= reach).length >
			labels.filter((o) => Math.abs(o.line.x0 - best) <= reach).length
				? x
				: best
		);
	labels = labels.filter((r) => Math.abs(r.line.x0 - edge) <= reach);
	if (labels.length < 3) return undefined;
	// Lines that each name several nutrients are running text, not table rows.
	if (labels.filter((r) => namesIn(r.line.folded) >= 2).length >= 2) return undefined;
	// The table is the longest run of rows with steady spacing; isolated mentions elsewhere are ignored.
	const gaps = labels.slice(1).map((r, i) => r.line.cy - labels[i].line.cy);
	const rowGap = [...gaps].sort((a, b) => a - b)[Math.floor(gaps.length / 2)] || 20;
	let best: typeof labels = [];
	let run: typeof labels = [labels[0]];
	for (let i = 1; i < labels.length; i++) {
		// Headers can sit between rows (a %RI header under the energy row), so allow a few rows' gap.
		if (labels[i].line.cy - labels[i - 1].line.cy <= rowGap * 3.5) run.push(labels[i]);
		else run = [labels[i]];
		if (run.length > best.length) best = [...run];
	}
	if (best.length < 3) return undefined;
	const left = Math.min(...best.map((r) => r.line.x0));
	const top = best[0].line.cy;
	const bottom = best[best.length - 1].line.cy;
	// Other lines starting at the names' edge between the rows are rows too (a misread "Lif" as "Jif", a vitamin):
	// they keep their numbers instead of passing them to a neighbour.
	for (const l of lines) {
		if (best.some((r) => r.line === l) || l.cy <= top || l.cy >= bottom) continue;
		if (Math.abs(l.x0 - edge) > reach || !/\p{L}{2}/u.test(l.text) || l.text.length > 60) continue;
		if (NOT_A_ROW.test(l.folded) || /^\s*[\d<%]/.test(l.folded)) continue;
		// The second line of a name just above ("davon gesättigte / Fettsäuren") belongs to that row.
		if (
			best.some((r) => r.hit.row !== 'other' && l.cy > r.line.cy && l.cy - r.line.cy < rowGap * 0.8)
		)
			continue;
		best.push({ line: l, hit: { row: 'other', end: l.text.search(/\d|$/) } });
	}
	best.sort((a, b) => a.line.cy - b.line.cy);
	const columns = headerColumns(
		lines.filter((l) => l.x1 > left),
		top - rowGap * 0.5,
		rowGap
	);

	// Each number joins the nearest row within reach; numbers on a row's own line stay with it.
	const cells = new Map<(typeof best)[number], Num[]>(best.map((r) => [r, []]));
	for (const r of best) {
		// A short bracket after the name is its unit, "(g)", which the OCR may read as "(9)": never a value.
		const own = r.line.text
			.slice(r.hit.end)
			.replace(/\([^)]{0,12}\)/g, (m) => ' '.repeat(m.length));
		const share = r.hit.end / Math.max(r.line.text.length, 1);
		cells
			.get(r)!
			.push(...numbers(own, r.line.x0 + (r.line.x1 - r.line.x0) * share, r.line.x1, r.line.score));
	}
	// Other numbers go to rows column by column, top to bottom, following the drift of a curved pack: each takes
	// the row (below the previous one) that best keeps the previous offset.
	const free = lines.filter(
		(l) =>
			!best.some((r) => r.line === l) &&
			!rowAt(l.folded) &&
			// Values sit clearly right of where the names start (a stray number in the names column is not one).
			l.x0 >= left + rowGap * 2 &&
			l.cy >= top - rowGap * 0.6 &&
			l.cy <= bottom + rowGap * 1.2 &&
			numbers(l.text).length > 0
	);
	const stacks: Line[][] = [];
	for (const l of [...free].sort((a, b) => a.cy - b.cy)) {
		const stack = stacks.find((st) => Math.abs(st[st.length - 1].cx - l.cx) <= rowGap * 1.5);
		if (stack) stack.push(l);
		else stacks.push([l]);
	}
	for (const stack of stacks) {
		let offset = 0;
		let after = -1;
		for (const l of stack) {
			// A line of kJ or kcal belongs to the energy row (energy is often on two lines), and one in grams never
			// does.
			const nums = numbers(l.text);
			const energyLine = nums.every(
				(n) => n.unit === 'kj' || n.unit === 'kcal' || n.units[0] !== null
			);
			const massLine = nums.some((n) => n.unit === 'g' || n.unit === 'mg');
			const energyRow = best.findIndex((r) => r.hit.row === 'energy');
			if (
				energyLine &&
				energyRow >= 0 &&
				Math.abs(l.cy - best[energyRow].line.cy) <= rowGap * 1.5
			) {
				cells.get(best[energyRow])!.push(...numbers(l.text, l.x0, l.x1, l.score));
				after = Math.max(after, energyRow);
				continue;
			}
			let pick = -1;
			// Values sit level with their name or a little below, rarely above: a tie goes to the row above.
			const missFor = (i: number) => {
				const dy = l.cy - best[i].line.cy;
				// Close to the drift so far, or simply level with the row: one odd offset (a two-line energy row) must
				// not push every later value off its row.
				return Math.min(Math.abs(dy - offset), Math.abs(dy)) + (dy < 0 ? rowGap * 0.2 : 0);
			};
			for (let i = after + 1; i < best.length; i++) {
				if (massLine && best[i].hit.row === 'energy') continue;
				if (missFor(i) <= rowGap * 0.75 && (pick < 0 || missFor(i) < missFor(pick))) pick = i;
			}
			if (pick < 0) continue;
			cells.get(best[pick])!.push(...numbers(l.text, l.x0, l.x1, l.score));
			offset = l.cy - best[pick].line.cy;
			after = pick;
		}
	}

	const amounts = columns.filter((c) => c.kind !== 'ri');
	const chosen =
		columns.find((c) => c.kind === 'per100') ?? columns.find((c) => c.kind === 'serving') ?? null;
	const out = new Map<string, NutrientValue>();
	for (const r of best) {
		const all = [...cells.get(r)!].sort((a, b) => a.x - b.x);
		let nums: Num[];
		if (columns.length) {
			// One number per column, or one per amount column with no percentages: they map in order. Otherwise
			// each goes to its nearest column. Either way a %RI
			// column claims its numbers, including a "%28" the OCR read as "9628".
			const ordered = [...columns].sort((a, b) => a.x - b.x);
			const amountColumns = ordered.filter((c) => c.kind !== 'ri');
			const plain = all.every((n) => !n.percent);
			const columnOf = (n: Num, i: number) =>
				all.length === ordered.length
					? ordered[i]
					: plain && all.length === amountColumns.length
						? amountColumns[i]
						: columns.reduce((a, b) => (Math.abs(b.x - n.x) < Math.abs(a.x - n.x) ? b : a));
			// With only %RI columns found, the amounts are the numbers left of the first of them.
			const firstRi = Math.min(...ordered.filter((c) => c.kind === 'ri').map((c) => c.x));
			nums = all.filter((n, i) =>
				n.percent
					? false
					: chosen
						? columnOf(n, i) === chosen
						: amountColumns.length
							? columnOf(n, i).kind !== 'ri'
							: n.x < firstRi - rowGap
			);
		} else nums = all.filter((n) => !n.percent).slice(0, 1);
		if (!nums.length || r.hit.row === 'other') continue;
		const per100 = chosen?.kind !== 'serving';
		const values =
			r.hit.row === 'energy' ? energy(nums, r.line.folded) : [amount(r.hit.row, nums[0], seen)];
		const used = r.hit.row === 'energy' ? nums.slice(0, 2) : nums.slice(0, 1);
		if (Math.min(...used.map((n) => n.score)) < UNCLEAR_BELOW)
			seen.unclear.push(...values.filter((v) => !out.has(v.code)).map((v) => v.code));
		add(out, values, seen, per100);
	}
	const portion = amounts.map((c) => ('portion' in c ? c.portion : null)).find(Boolean) ?? null;
	// No basis column: the title may say it ("Enerji ve Besin Öğeleri (100g'da)", "100 g için Besin Öğeleri").
	const titled = chosen
		? null
		: lines
				.filter(
					(l) => l.cy < top && l.cy > top - rowGap * 6 && /100\s*(g|ml)\b|100(g|ml)/.test(l.folded)
				)
				.map((l) => (/100\s*ml/.test(l.folded) ? ('100ml' as const) : ('100g' as const)))[0];
	const basis =
		titled ??
		(chosen
			? chosen.kind === 'per100'
				? chosen.unit === 'ml'
					? ('100ml' as const)
					: ('100g' as const)
				: ('serving' as const)
			: null);
	const notes: LabelNote[] = [];
	if (chosen && basis)
		notes.push({
			kind: 'columns',
			used: basis,
			skippedServing: amounts.some((c) => c !== chosen && c.kind === 'serving'),
			skippedRi: columns.some((c) => c.kind === 'ri'),
			portion: !!portion && basis !== 'serving'
		});
	if (titled) notes.push({ kind: 'basis_from_title', basis: titled });
	return { basis, portion, nutrients: [...out.values()], layout: 'table', notes };
}

/** Where nutrient names start in a text, longest match first, without overlaps. */
function marksIn(text: string): { row: Row; at: number; end: number }[] {
	const marks: { row: Row; at: number; end: number }[] = [];
	for (const m of text.matchAll(/\p{L}+/gu)) {
		if (marks.some((k) => m.index! < k.end)) continue;
		const hit = rowAt(text.slice(m.index!));
		if (hit) marks.push({ row: hit.row, at: m.index!, end: m.index! + hit.end });
	}
	return marks;
}

/** How many different nutrients a text names. */
const namesIn = (text: string) => new Set(marksIn(text).map((k) => k.row)).size;

/** Running text: each name takes the first number after it, up to the next name or a second basis. */
function parseText(lines: Line[], seen: Seen): Read | undefined {
	// The paragraph: lines that name nutrients, and lines starting near them (not a column off to the side).
	const named = lines.filter((l) => marksIn(l.folded).length > 0);
	if (!named.length) return undefined;
	const starts = named.map((l) => l.x0).sort((a, b) => a - b);
	const widths = named.map((l) => l.x1 - l.x0).sort((a, b) => a - b);
	const reach = starts[Math.floor(starts.length / 2)] + widths[Math.floor(widths.length / 2)] * 0.5;
	const text = lines
		.filter((l) => l.x0 <= reach)
		.sort((a, b) => a.cy - b.cy || a.x0 - b.x0)
		.map((l) => l.folded)
		.join(' ');
	const marks = marksIn(text).filter(
		(k) => !(k.row === 'energy' && /^\s*(ve|ye|and|&)\b/.test(text.slice(k.end)))
	);
	// Values start at energy: names before it belong to the ingredients ("tuz", "sodyum polifosfat").
	const first = marks.findIndex((k) => k.row === 'energy');
	if (first > 0) marks.splice(0, first);
	if (new Set(marks.map((k) => k.row)).size < 3) return undefined;
	const start = marks[0].at;
	// A second basis ("1 porsiyon için (30 g)") after the first values ends the first block.
	const second = /\(?\s*1\s*(porsiyon|portion|serving)/.exec(text.slice(start + 20));
	const stop = second ? start + 20 + second.index : text.length;
	const basisText = text.slice(Math.max(0, start - 80), start);
	const out = new Map<string, NutrientValue>();
	for (let i = 0; i < marks.length; i++) {
		const k = marks[i];
		if (k.at >= stop) break;
		const until = Math.min(marks[i + 1]?.at ?? stop, stop);
		const nums = numbers(text.slice(k.end, until)).filter((n) => !n.percent);
		if (!nums.length) continue;
		if (k.row === 'energy') add(out, energy(nums, text.slice(k.at, until)), seen);
		else if (k.row !== 'other') add(out, [amount(k.row, nums[0], seen)], seen);
	}
	const basis = /100\s*ml/.test(basisText) ? '100ml' : /100\s*g/.test(basisText) ? '100g' : null;
	return {
		basis,
		portion: null,
		nutrients: [...out.values()],
		layout: 'text',
		notes: [{ kind: 'running_text' }]
	};
}

/** Reads a nutrition label from OCR lines. */
export function parseLabel(ocr: OcrLine[]): LabelProposal {
	const lines = ocr.filter((l) => l.text.trim()).map(toLine);
	// Once a table is recognised it is never re-read as running text: that is where confident wrong numbers come
	// from. Values the table didn't give stay unknown for the person to fill in.
	// A table that is recognised keeps only what it saw; a failed attempt's choices are not reported.
	let seen: Seen = { dropped: [], milligrams: [], unclear: [] };
	const fresh = () => (seen = { dropped: [], milligrams: [], unclear: [] });
	const result = parseTable(lines, seen) ??
		parseText(lines, fresh()) ?? {
			basis: null,
			portion: null,
			nutrients: [],
			layout: 'none' as const,
			notes: []
		};
	const kept = new Set(result.nutrients.map((n) => n.code));
	const unique = (codes: NutrientCode[]) => [...new Set(codes)];
	const dropped = unique(seen.dropped).filter((c) => !kept.has(c));
	const milligrams = unique(seen.milligrams).filter((c) => kept.has(c));
	const notes = [...result.notes];
	if (dropped.length) notes.push({ kind: 'dropped', codes: dropped });
	if (milligrams.length) notes.push({ kind: 'converted_mg', codes: milligrams });
	const unclear = unique(seen.unclear).filter((c) => kept.has(c));
	if (unclear.length) notes.push({ kind: 'unclear', codes: unclear });
	return {
		...result,
		notes,
		warnings: foodWarnings(result.basis ?? '100g', result.nutrients)
	};
}
