// Development evaluation of the label parser against private OCR output and hand-read values (never committed):
//   node scripts/label-eval.ts <ocr.jsonl> <ground_truth.tsv> [--show]
// Scores the first (per 100 g/ml) row of each label: field accuracy, wrong values (serious) and missing ones.
import { readFileSync } from 'node:fs';
import { parseLabel, type OcrLine } from '../src/lib/server/modules/label-parser/index.ts';

const [ocrPath, truthPath] = process.argv.slice(2);
const show = process.argv.includes('--show');
const ocr = readFileSync(ocrPath, 'utf8')
	.trim()
	.split('\n')
	.map((l) => JSON.parse(l) as { image?: string; lines?: OcrLine[] })
	.filter((r) => r.image);
const [head, ...rows] = readFileSync(truthPath, 'utf8')
	.trim()
	.split('\n')
	.map((l) => l.split('\t'));
const FIELDS: [string, string][] = [
	['energy_kj', 'energy_kj'],
	['energy_kcal', 'energy_kcal'],
	['fat', 'fat'],
	['saturated_fat', 'saturated_fat'],
	['carbohydrate', 'carbohydrate_excl_fibre'],
	['sugars', 'sugars'],
	['fibre', 'fibre'],
	['protein', 'protein'],
	['salt', 'salt']
];
const seen = new Set<string>();
let right = 0;
let wrong = 0;
let missing = 0;
let extra = 0;
let full = 0;
let basisRight = 0;
for (const row of rows) {
	const t = Object.fromEntries(head.map((h, i) => [h, row[i] ?? '']));
	if (seen.has(t.label)) continue; // the first row of a label is its per-100 row
	seen.add(t.label);
	const image = ocr.find((r) => r.image === t.label);
	if (!image) continue;
	const p = parseLabel(image.lines!);
	const got = new Map(p.nutrients.map((n) => [n.code, n.value]));
	const expectBasis = t.basis.replace(' ', '');
	if (p.basis === expectBasis) basisRight += 1;
	let ok = p.basis === expectBasis;
	const notes: string[] = [];
	for (const [col, code] of FIELDS) {
		const want = t[col] === '' ? undefined : Number(t[col]);
		const have = got.get(code);
		if (want === undefined) {
			if (have !== undefined) {
				extra += 1;
				ok = false;
				notes.push(`${col}: extra ${have}`);
			}
		} else if (have === undefined) {
			missing += 1;
			ok = false;
			notes.push(`${col}: missing (${want})`);
		} else if (Math.abs(have - want) < 1e-6) right += 1;
		else {
			wrong += 1;
			ok = false;
			notes.push(`${col}: WRONG ${have} (${want})`);
		}
	}
	if (ok) full += 1;
	console.log(
		`${t.label} ${p.layout} basis=${p.basis}${p.basis === expectBasis ? '' : ` (want ${expectBasis})`} portion=${p.portion ? `${p.portion.name} ${p.portion.amount}${p.portion.unit}` : '-'} warnings=${p.warnings.join(',') || '-'}${notes.length ? '\n   ' + notes.join('\n   ') : ' ✓'}`
	);
	if (show) console.log(p.nutrients);
}
const total = right + wrong + missing;
console.log(
	`\nlabels ${seen.size}, fully right ${full}, basis right ${basisRight}; values ${total}: right ${right} (${Math.round((100 * right) / total)}%), wrong ${wrong}, missing ${missing}, extra ${extra}`
);
