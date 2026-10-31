// Reads a LoseIt export (docs/loseit-export.md) into plain records, with no database or file access. The layout is
// recognised by its exact headers; anything else stops with a clear reason rather than being guessed. Values are kept
// as LoseIt stated them: "n/a" is unknown (never zero), deleted rows are left out, a diary row keeps its own totals.
import { strFromU8, unzipSync } from 'fflate';
import type { EntryNutrients } from '../../../shared/diary-types.ts';
import type { NutrientCode } from '../../../shared/nutrients.ts';

export const LOSEIT_LIMITS = { archiveBytes: 20 * 1024 * 1024, unpackedBytes: 100 * 1024 * 1024 };

export class LoseItError extends Error {
	readonly code: 'not_loseit' | 'unsupported_layout' | 'too_large' | 'invalid_value';
	readonly detail?: string;
	constructor(
		code: 'not_loseit' | 'unsupported_layout' | 'too_large' | 'invalid_value',
		detail?: string
	) {
		super(detail ? `${code}: ${detail}` : code);
		this.code = code;
		this.detail = detail;
	}
}

const HEADERS = {
	'food-logs.csv':
		'Date,Name,Icon,Meal,Quantity,Units,Calories,Deleted,Fat (g),Protein (g),Carbohydrates (g),Saturated Fat (g),Sugars (g),Fiber (g),Cholesterol (mg),Sodium (mg)',
	'custom-foods.csv':
		'Name,UniqueId,Brand,Image,Quantity,Measure,Calories,Fat (g),Protein (g),Carbohydrates (g),Saturated Fat (g),Sugars (g),Fiber (g),Cholesterol (mg),Sodium (mg)',
	'weights.csv': 'Date,Weight,Last Updated,Deleted',
	'water-intake.csv': 'Date,Value,Secondary Value,Last Updated',
	'exercise-logs.csv': 'Date,Name,Icon,Type,Quantity,Units,Calories,Deleted',
	'daily-calorie-summary.csv': 'Date,Food cals,Exercise cals,Budget cals,EER',
	'daily-values.csv': 'Date,Name,Value',
	'profile.csv': 'Name,Value'
} as const;
type FileName = keyof typeof HEADERS;

// Diary meals: LoseIt's extra snack meals become Snacks (owner decision, 2026-10-30).
const MEALS = {
	Breakfast: 'breakfast',
	Lunch: 'lunch',
	Dinner: 'dinner',
	Snacks: 'snacks',
	'Morning Snacks': 'snacks',
	'Afternoon Snacks': 'snacks'
} as const;
export type LoseItMeal = (typeof MEALS)[keyof typeof MEALS];

/** A logged amount: grams and millilitres are physical; anything else is a count of a named portion. */
export type LoseItUnit =
	{ kind: 'mass'; unit: 'g' } | { kind: 'volume'; unit: 'ml' } | { kind: 'count'; label: string };

export interface LoseItEntry {
	/** Position in the file, for messages. */
	row: number;
	date: string;
	meal: LoseItMeal;
	/** As LoseIt named the meal, which is part of the entry's identity. */
	sourceMeal: string;
	name: string;
	quantity: number;
	unit: LoseItUnit;
	/** Totals for the logged amount, as exported. */
	nutrients: EntryNutrients;
	/** The row's own text, for matching the same row in a later export. */
	fingerprint: string;
}

export interface LoseItFood {
	uniqueId: string;
	name: string;
	brand: string | null;
	quantity: number;
	unit: LoseItUnit;
	/** For the stated quantity. */
	nutrients: EntryNutrients;
}

export interface LoseItData {
	entries: LoseItEntry[];
	deletedEntries: number;
	foods: LoseItFood[];
	weights: { date: string; value: number; fingerprint: string }[];
	water: { date: string; ml: number }[];
	/** Calories LoseIt credited for activity (positive), recorded but never counted toward the budget. */
	activity: { date: string; name: string; kcal: number; fingerprint: string }[];
	days: { date: string; foodKcal: number; budgetKcal: number | null }[];
	completed: string[];
	profile: { birthDate: string | null; sex: 'female' | 'male' | null; height: number | null };
}

/** Which kind of export an upload is, from its file names alone (nothing is decompressed). */
export function archiveKind(bytes: Uint8Array): 'obur' | 'loseit' | 'unknown' {
	const names: string[] = [];
	try {
		unzipSync(bytes, {
			filter: (file) => {
				names.push(file.name);
				return false;
			}
		});
	} catch {
		return 'unknown';
	}
	if (names.includes('manifest.json')) return 'obur';
	return isLoseItArchive(names) ? 'loseit' : 'unknown';
}

/** True when the archive looks like a LoseIt export (so the caller can choose the right reader). */
export function isLoseItArchive(names: string[]): boolean {
	return names.includes('food-logs.csv') && names.includes('daily-calorie-summary.csv');
}

// CSV ------------------------------------------------------------------------------------------------------------

/** RFC 4180 rows: quoted fields may contain commas, quotes ("") and line breaks. */
export function parseCsv(text: string): string[][] {
	const rows: string[][] = [];
	let row: string[] = [];
	let field = '';
	let quoted = false;
	for (let i = 0; i < text.length; i++) {
		const c = text[i];
		if (quoted) {
			if (c === '"' && text[i + 1] === '"') {
				field += '"';
				i++;
			} else if (c === '"') quoted = false;
			else field += c;
		} else if (c === '"') quoted = true;
		else if (c === ',') {
			row.push(field);
			field = '';
		} else if (c === '\n' || c === '\r') {
			if (c === '\r' && text[i + 1] === '\n') i++;
			row.push(field);
			rows.push(row);
			row = [];
			field = '';
		} else field += c;
	}
	if (field !== '' || row.length) {
		row.push(field);
		rows.push(row);
	}
	return rows.filter((r) => r.length > 1 || r[0] !== '');
}

// Values ---------------------------------------------------------------------------------------------------------

const bad = (file: string, row: number, what: string): never => {
	throw new LoseItError('invalid_value', `${file} row ${row}: ${what}`);
};

/** M/D/YYYY → YYYY-MM-DD, checking the day exists. */
export function usDate(value: string): string | null {
	const m = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(value.trim());
	if (!m) return null;
	const [month, day, year] = [Number(m[1]), Number(m[2]), Number(m[3])];
	const d = new Date(Date.UTC(year, month - 1, day));
	if (d.getUTCFullYear() !== year || d.getUTCMonth() !== month - 1 || d.getUTCDate() !== day)
		return null;
	return `${m[3]}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

/**
 * A number as LoseIt writes it: dot decimals; "n/a" or empty is unknown. Only where `thousands` is set (the
 * Calories column) is a comma a thousands separator, and then only in groups of three.
 */
export function number(value: string, thousands = false): number | null {
	let v = value.trim();
	if (v === '' || v.toLowerCase() === 'n/a') return null;
	if (thousands && /^-?\d{1,3}(,\d{3})+(\.\d+)?$/.test(v)) v = v.replace(/,/g, '');
	if (!/^-?\d+(\.\d+)?$/.test(v)) return Number.NaN;
	return Number(v);
}

const SINGULAR: Record<string, string> = {
	Servings: 'Serving',
	Teaspoons: 'Teaspoon',
	Tablespoons: 'Tablespoon',
	Slices: 'Slice',
	Pieces: 'Piece',
	Cans: 'Can',
	Bottles: 'Bottle',
	Cups: 'Cup'
};

export function unitOf(label: string): LoseItUnit {
	const l = label.trim();
	if (l === 'Grams' || l === 'Gram') return { kind: 'mass', unit: 'g' };
	if (l === 'Milliliters' || l === 'Milliliter') return { kind: 'volume', unit: 'ml' };
	return { kind: 'count', label: SINGULAR[l] ?? l };
}

// The nutrient columns shared by food logs and custom foods. LoseIt does not say which carbohydrate definition a
// value uses (its database is largely US, the owner's own foods come from Turkish/EU labels), so it is kept as an
// unspecified carbohydrate rather than assumed to be either (docs/design.md, "Data model and nutrient contract").
const NUTRIENT_COLUMNS: [string, NutrientCode][] = [
	['Fat (g)', 'fat'],
	['Protein (g)', 'protein'],
	['Carbohydrates (g)', 'carbohydrate_unspecified'],
	['Saturated Fat (g)', 'saturated_fat'],
	['Sugars (g)', 'sugars'],
	['Fiber (g)', 'fibre'],
	['Cholesterol (mg)', 'cholesterol'],
	['Sodium (mg)', 'sodium']
];

function nutrientsOf(file: string, row: number, get: (column: string) => string): EntryNutrients {
	const out: EntryNutrients = {};
	const kcal = number(get('Calories'), true);
	if (Number.isNaN(kcal) || (kcal !== null && kcal < 0)) bad(file, row, 'calories');
	if (kcal !== null) out.energy_kcal = { value: kcal, qualifier: 'reported' };
	for (const [column, code] of NUTRIENT_COLUMNS) {
		const value = number(get(column));
		if (Number.isNaN(value) || (value !== null && value < 0)) bad(file, row, column);
		if (value !== null) out[code] = { value, qualifier: 'reported' };
	}
	return out;
}

// Reading --------------------------------------------------------------------------------------------------------

function table(files: Record<string, string>, name: FileName) {
	const text = files[name];
	if (text === undefined) throw new LoseItError('unsupported_layout', `missing ${name}`);
	const [header, ...rows] = parseCsv(text.replace(/^\uFEFF/, ''));
	if (header?.join(',') !== HEADERS[name]) {
		throw new LoseItError('unsupported_layout', `${name} has different columns than expected`);
	}
	return rows.map((cells, i) => {
		if (cells.length !== header.length) bad(name, i + 2, `expected ${header.length} fields`);
		const get = (column: string) => cells[header.indexOf(column)];
		return { row: i + 2, get };
	});
}

/** Reads the CSV files of an export (already unpacked) into records. */
export function readLoseItFiles(files: Record<string, string>): LoseItData {
	const date = (file: string, row: number, value: string) =>
		usDate(value) ?? bad(file, row, 'date');

	let deletedEntries = 0;
	const entries: LoseItEntry[] = [];
	for (const { row, get } of table(files, 'food-logs.csv')) {
		if (get('Deleted') !== '0') {
			if (get('Deleted') === '1') deletedEntries++;
			else bad('food-logs.csv', row, 'deleted flag');
			continue;
		}
		const sourceMeal = get('Meal');
		const meal =
			MEALS[sourceMeal as keyof typeof MEALS] ?? bad('food-logs.csv', row, `meal "${sourceMeal}"`);
		const quantity = number(get('Quantity'));
		if (quantity === null || Number.isNaN(quantity) || quantity <= 0)
			bad('food-logs.csv', row, 'quantity');
		const name = get('Name').trim();
		if (!name) bad('food-logs.csv', row, 'name');
		entries.push({
			row,
			date: date('food-logs.csv', row, get('Date')),
			meal,
			sourceMeal,
			name,
			quantity: quantity!,
			unit: unitOf(get('Units')),
			nutrients: nutrientsOf('food-logs.csv', row, get),
			fingerprint: HEADERS['food-logs.csv']
				.split(',')
				.filter((c) => c !== 'Icon' && c !== 'Deleted')
				.map((c) => get(c))
				.join('\u001f')
		});
	}

	const foods: LoseItFood[] = table(files, 'custom-foods.csv').map(({ row, get }) => {
		const quantity = number(get('Quantity'));
		if (quantity === null || Number.isNaN(quantity) || quantity <= 0)
			bad('custom-foods.csv', row, 'quantity');
		const uniqueId = get('UniqueId').trim();
		if (!/^[0-9a-f]{32}$/i.test(uniqueId)) bad('custom-foods.csv', row, 'unique ID');
		return {
			uniqueId,
			name: get('Name').trim(),
			brand: get('Brand').trim() || null,
			quantity: quantity!,
			unit: unitOf(get('Measure')),
			nutrients: nutrientsOf('custom-foods.csv', row, get)
		};
	});

	const weights = table(files, 'weights.csv').flatMap(({ row, get }) => {
		if (get('Deleted') === 'true') return [];
		if (get('Deleted') !== 'false') bad('weights.csv', row, 'deleted flag');
		const value = number(get('Weight'));
		if (value === null || Number.isNaN(value) || value <= 0) bad('weights.csv', row, 'weight');
		const d = date('weights.csv', row, get('Date'));
		return [{ date: d, value: value!, fingerprint: `${get('Date')}\u001f${get('Weight')}` }];
	});

	const water = table(files, 'water-intake.csv').flatMap(({ row, get }) => {
		const ml = number(get('Value'));
		if (ml === null || Number.isNaN(ml) || ml < 0) bad('water-intake.csv', row, 'value');
		// Daily totals; float noise such as 1999.99 is rounded to the millilitre.
		const rounded = Math.round(ml!);
		return rounded > 0 ? [{ date: date('water-intake.csv', row, get('Date')), ml: rounded }] : [];
	});

	const activity = table(files, 'exercise-logs.csv').flatMap(({ row, get }) => {
		// 0 is active; anything else (LoseIt uses 4) is not.
		if (get('Deleted') !== '0') return [];
		const kcal = number(get('Calories'), true);
		if (kcal === null || Number.isNaN(kcal)) bad('exercise-logs.csv', row, 'calories');
		// LoseIt stores calories burned as negative numbers.
		const burned = Math.round(Math.abs(kcal!));
		if (burned === 0) return [];
		return [
			{
				date: date('exercise-logs.csv', row, get('Date')),
				name: get('Name').trim() || 'Activity',
				kcal: burned,
				fingerprint: ['Date', 'Name', 'Type', 'Quantity', 'Units', 'Calories']
					.map(get)
					.join('\u001f')
			}
		];
	});

	const days = table(files, 'daily-calorie-summary.csv').map(({ row, get }) => {
		const food = number(get('Food cals'), true);
		const budget = number(get('Budget cals'), true);
		if (food === null || Number.isNaN(food) || Number.isNaN(budget))
			bad('daily-calorie-summary.csv', row, 'value');
		return {
			date: date('daily-calorie-summary.csv', row, get('Date')),
			foodKcal: food!,
			budgetKcal: budget === null ? null : Math.round(budget)
		};
	});

	const completed = table(files, 'daily-values.csv')
		.filter(({ get }) => get('Name') === 'Complete' && get('Value') !== '0')
		.map(({ row, get }) => date('daily-values.csv', row, get('Date')));

	const profileRows = new Map(
		table(files, 'profile.csv').map(({ get }) => [get('Name'), get('Value').trim()])
	);
	const gender = profileRows.get('Gender')?.toLowerCase();
	const height = number(profileRows.get('Height') ?? '');

	return {
		entries,
		deletedEntries,
		foods,
		weights,
		water,
		activity,
		days,
		completed: [...new Set(completed)].sort(),
		profile: {
			birthDate: usDate(profileRows.get('Birthday') ?? ''),
			sex: gender === 'male' || gender === 'female' ? gender : null,
			height: height === null || Number.isNaN(height) ? null : height
		}
	};
}

/** Unpacks an export and reads it. The archive's other files (recipes, steps, photos …) are not used. */
export function readLoseItArchive(bytes: Uint8Array): LoseItData {
	if (bytes.length > LOSEIT_LIMITS.archiveBytes) throw new LoseItError('too_large');
	let total = 0;
	let unpacked: Record<string, Uint8Array>;
	try {
		unpacked = unzipSync(bytes, {
			filter: (file) => {
				const wanted = file.name in HEADERS;
				if (wanted) total += file.originalSize;
				if (total > LOSEIT_LIMITS.unpackedBytes) throw new LoseItError('too_large');
				return wanted;
			}
		});
	} catch (e) {
		if (e instanceof LoseItError) throw e;
		throw new LoseItError('not_loseit');
	}
	if (!isLoseItArchive(Object.keys(unpacked))) throw new LoseItError('not_loseit');
	const files: Record<string, string> = {};
	for (const [name, data] of Object.entries(unpacked)) files[name] = strFromU8(data);
	return readLoseItFiles(files);
}
