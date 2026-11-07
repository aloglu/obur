// A nutrition table copied by a remote vision model (docs/design.md, "Remote models for Speak and Scan"), read by the
// same parser as the local OCR's lines. The model returns printed strings only; this lays them out as lines in a
// grid (title, column headers, then a row per nutrient) so every rule stays in one place: which column is used, row
// names, "<" bounds, decimal commas, values no food can have, and the notes. Numbers are never taken from the model
// as numbers. Pure.
import * as v from 'valibot';
import { parseLabel, type LabelProposal, type OcrLine } from './parse.ts';

/** What the model is asked to return (and the JSON schema it is given, below). */
export const LabelTable = v.object({
	title: v.nullable(v.pipe(v.string(), v.maxLength(200))),
	columns: v.pipe(v.array(v.pipe(v.string(), v.maxLength(80))), v.maxLength(8)),
	rows: v.pipe(
		v.array(
			v.object({
				name: v.pipe(v.string(), v.maxLength(120)),
				values: v.pipe(v.array(v.nullable(v.pipe(v.string(), v.maxLength(40)))), v.maxLength(8))
			})
		),
		v.maxLength(40)
	)
});
export type LabelTable = v.InferOutput<typeof LabelTable>;

/** The schema handed to the model, matching LabelTable (strict structured output: every field required). */
export const LABEL_TABLE_SCHEMA = {
	type: 'object',
	additionalProperties: false,
	required: ['title', 'columns', 'rows'],
	properties: {
		title: {
			type: ['string', 'null'],
			description: 'The table heading as printed, or null when there is none.'
		},
		columns: {
			type: 'array',
			description:
				'Each value column’s header as printed, left to right (e.g. "per 100 g", "per serving (30 g)", "%RI").',
			items: { type: 'string' }
		},
		rows: {
			type: 'array',
			items: {
				type: 'object',
				additionalProperties: false,
				required: ['name', 'values'],
				properties: {
					name: { type: 'string', description: 'The row name as printed.' },
					values: {
						type: 'array',
						description:
							'One entry per column, the value exactly as printed with its unit and any "<" (e.g. "2,5 g", "<0,5 g", "1098 kJ / 265 kcal"); null when unreadable or empty.',
						items: { type: ['string', 'null'] }
					}
				}
			}
		}
	}
} as const;

const NAME_X = 100;
const COLUMN_X = 340;
const COLUMN_GAP = 240;
const ROW_GAP = 26;

const line = (text: string, x: number, y: number, w = Math.max(8, text.length * 8)): OcrLine => ({
	text,
	box: [
		[x, y],
		[x + w, y],
		[x + w, y + 20],
		[x, y + 20]
	],
	score: 1
});

/** Reads a copied table as the label parser reads a photo's lines. */
export function parseLabelTable(table: LabelTable): Omit<LabelProposal, 'notes'> & {
	notes: LabelProposal['notes'];
} {
	const lines: OcrLine[] = [];
	if (table.title?.trim()) lines.push(line(table.title.trim(), NAME_X, 20));
	table.columns.forEach((c, i) => {
		if (c.trim()) lines.push(line(c.trim(), COLUMN_X + i * COLUMN_GAP, 60, 160));
	});
	table.rows.forEach((r, i) => {
		const y = 120 + i * ROW_GAP;
		if (r.name.trim()) lines.push(line(r.name.trim(), NAME_X, y, 200));
		r.values.forEach((value, j) => {
			if (value?.trim()) lines.push(line(value.trim(), COLUMN_X + j * COLUMN_GAP, y, 120));
		});
	});
	return parseLabel(lines);
}
