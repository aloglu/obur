// The portable archive (docs/design.md, "Your data: export, import and deletion"): a ZIP with canonical JSON under
// data/, convenient CSV views under csv/ and a manifest with the format version, units, row counts and SHA-256 of
// every file. Reading validates paths, sizes, checksums and every record before anything is written. Checksums
// detect damage; they do not make an archive trustworthy, so the content is validated as untrusted input.
import { createHash } from 'node:crypto';
import { strFromU8, strToU8, unzipSync, zipSync, type Unzipped } from 'fflate';
import * as v from 'valibot';
import { DateString, Zone } from '../../../shared/diary-input.ts';
import { MEALS } from '../../../shared/diary-types.ts';
import { NUTRIENT_CODES, QUALIFIERS } from '../../../shared/nutrients.ts';
import { MASS_UNITS, VOLUME_UNITS } from '../../../shared/quantity.ts';

export const FORMAT = 'obur-export';
export const FORMAT_VERSION = 1;
export const LIMITS = {
	archiveBytes: 20 * 1024 * 1024,
	unpackedBytes: 200 * 1024 * 1024,
	files: 32,
	rowsPerFile: 500_000
};

export const EXCLUDED = [
	'passkeys and security keys',
	'sessions',
	'recovery codes and links',
	'invites',
	'server configuration',
	'other people’s data and who created shared foods'
];

// Records ---------------------------------------------------------------------------------------------------------

const Uuid = v.pipe(v.string(), v.uuid());
const Timestamp = v.pipe(v.string(), v.isoTimestamp());
const NonNegative = v.pipe(v.number(), v.finite(), v.minValue(0));
const Positive = v.pipe(v.number(), v.finite(), v.gtValue(0));
const Text = (max: number) => v.pipe(v.string(), v.minLength(1), v.maxLength(max));

const NutrientValue = v.object({
	code: v.picklist(NUTRIENT_CODES),
	value: NonNegative,
	qualifier: v.picklist(QUALIFIERS)
});
const Serving = v.object({
	id: Uuid,
	name: Text(60),
	amount: Positive,
	unit: v.picklist(['g', 'ml'])
});

export const FoodRecord = v.object({
	id: Uuid,
	/** Created by the exporting person; otherwise a food they used that someone else shared. */
	mine: v.boolean(),
	visibility: v.picklist(['private', 'shared']),
	name: Text(200),
	brand: v.nullable(Text(120)),
	basis: v.picklist(['100g', '100ml', 'serving']),
	servingLabel: v.nullable(Text(200)),
	servingAmount: v.nullable(Positive),
	servingUnit: v.nullable(v.picklist(['g', 'ml'])),
	barcode: v.nullable(v.pipe(v.string(), v.regex(/^[0-9]{8,14}$/))),
	origin: v.picklist(['manual', 'label_scan', 'loseit', 'curated', 'variant', 'recipe']),
	sourceMeta: v.nullable(v.record(v.string(), v.unknown())),
	derivedFrom: v.nullable(Uuid),
	archivedAt: v.nullable(Timestamp),
	createdAt: Timestamp,
	updatedAt: Timestamp,
	nutrients: v.array(NutrientValue),
	servings: v.array(
		v.object({ ...Serving.entries, source: v.picklist(['label', 'user', 'estimate', 'reference']) })
	)
});

const SnapshotUnit = v.variant('kind', [
	v.object({
		kind: v.literal('mass'),
		unit: v.picklist(Object.keys(MASS_UNITS) as (keyof typeof MASS_UNITS)[])
	}),
	v.object({
		kind: v.literal('volume'),
		unit: v.picklist(Object.keys(VOLUME_UNITS) as (keyof typeof VOLUME_UNITS)[])
	}),
	v.object({ kind: v.literal('measure'), code: Text(40), name: Text(60), ml: Positive }),
	v.object({ kind: v.literal('basis_serving') }),
	v.object({
		kind: v.literal('serving'),
		servingId: Uuid,
		name: Text(60),
		amount: Positive,
		unit: v.picklist(['g', 'ml'])
	})
]);

const FoodSnapshot = v.object({
	name: Text(200),
	brand: v.nullable(Text(120)),
	basis: v.picklist(['100g', '100ml', 'serving']),
	servingLabel: v.nullable(Text(200)),
	servingSize: v.nullable(v.object({ amount: Positive, unit: v.picklist(['g', 'ml']) })),
	servings: v.array(Serving),
	basisNutrients: v.array(NutrientValue)
});

const EntryNutrients = v.pipe(
	v.record(
		v.picklist(NUTRIENT_CODES),
		v.object({ value: NonNegative, qualifier: v.picklist(QUALIFIERS) })
	)
);

const Lifecycle = {
	revision: v.pipe(v.number(), v.integer(), v.minValue(1)),
	createdAt: Timestamp,
	updatedAt: Timestamp,
	deletedAt: v.nullable(Timestamp)
};

export const DiaryRecord = v.pipe(
	v.object({
		id: Uuid,
		localDate: DateString,
		meal: v.picklist(MEALS),
		zone: Zone,
		eatenAt: v.nullable(Timestamp),
		kind: v.picklist(['food', 'quick']),
		foodId: v.nullable(Uuid),
		food: v.nullable(FoodSnapshot),
		amount: v.nullable(Positive),
		unit: v.nullable(SnapshotUnit),
		description: v.nullable(Text(200)),
		nutrients: EntryNutrients,
		...Lifecycle
	}),
	v.check(
		(e) =>
			e.kind === 'food'
				? e.food !== null && e.amount !== null && e.unit !== null
				: e.food === null &&
					e.amount === null &&
					e.unit === null &&
					e.foodId === null &&
					e.nutrients.energy_kcal !== undefined,
		'Entry shape does not match its kind'
	)
);

// Saved meals: items keep their own snapshot, like diary entries (item IDs are not portable).
const SavedMealItemRecord = v.pipe(
	v.object({
		kind: v.picklist(['food', 'quick']),
		foodId: v.nullable(Uuid),
		food: v.nullable(FoodSnapshot),
		amount: v.nullable(Positive),
		unit: v.nullable(SnapshotUnit),
		description: v.nullable(Text(200)),
		nutrients: EntryNutrients
	}),
	v.check(
		(e) =>
			e.kind === 'food'
				? e.food !== null && e.amount !== null && e.unit !== null
				: e.food === null &&
					e.amount === null &&
					e.unit === null &&
					e.foodId === null &&
					e.nutrients.energy_kcal !== undefined,
		'Item shape does not match its kind'
	)
);
export const SavedMealRecord = v.object({
	id: Uuid,
	name: Text(120),
	revision: v.pipe(v.number(), v.integer(), v.minValue(1)),
	createdAt: Timestamp,
	updatedAt: Timestamp,
	items: v.pipe(v.array(SavedMealItemRecord), v.minLength(1), v.maxLength(100))
});

const Reading = {
	id: Uuid,
	localDate: DateString,
	zone: Zone,
	source: v.picklist(['manual', 'loseit']),
	...Lifecycle
};
export const WeightRecord = v.object({
	...Reading,
	measuredAt: v.nullable(Timestamp),
	kg: v.pipe(v.number(), v.gtValue(0), v.ltValue(700))
});
export const WaterRecord = v.object({
	...Reading,
	ml: v.pipe(v.number(), v.gtValue(0), v.maxValue(10_000))
});
export const ActivityRecord = v.pipe(
	v.object({
		...Reading,
		kcal: v.pipe(v.number(), v.integer(), v.gtValue(0), v.maxValue(10_000)),
		note: v.nullable(Text(120)),
		countsTowardBudget: v.boolean(),
		// Added 2026-10-30; older archives have only workout-style entries.
		kind: v.optional(v.picklist(['extra', 'day_total']), 'extra')
	}),
	v.check((a) => a.source !== 'manual' || a.countsTowardBudget, 'Manual activity always counts')
);

export const TargetRecord = v.pipe(
	v.object({
		id: Uuid,
		effectiveFrom: DateString,
		mode: v.picklist(['calculated', 'manual', 'none']),
		baseBurnKcal: v.nullable(v.pipe(v.number(), v.integer(), v.minValue(500), v.maxValue(10_000))),
		deficitKcal: v.pipe(v.number(), v.integer(), v.minValue(0), v.maxValue(1100)),
		floorKcal: v.pipe(v.number(), v.integer(), v.minValue(0), v.maxValue(5000)),
		goalWeightKg: v.nullable(v.pipe(v.number(), v.minValue(20), v.maxValue(700))),
		rateKgPerWeek: v.nullable(v.pipe(v.number(), v.minValue(0), v.maxValue(1))),
		proteinGPerKg: v.nullable(v.pipe(v.number(), v.minValue(0), v.maxValue(3))),
		proteinBasisKg: v.nullable(v.pipe(v.number(), v.gtValue(0), v.maxValue(700))),
		fatShare: v.nullable(v.pipe(v.number(), v.minValue(0), v.maxValue(1))),
		inputs: v.record(v.string(), v.unknown()),
		calculationVersion: Text(40),
		// Added 2026-10-30; older archives read with the defaults then in force.
		countActivity: v.optional(v.boolean(), true),
		atGoal: v.optional(v.picklist(['keep', 'maintain']), 'keep'),
		// Added 2026-10-30 (own macro percentages); older archives are balanced. The database checks the shares.
		macroMode: v.optional(v.picklist(['balanced', 'percent']), 'balanced'),
		proteinShare: v.optional(v.nullable(v.pipe(v.number(), v.minValue(0), v.maxValue(1))), null),
		carbShare: v.optional(v.nullable(v.pipe(v.number(), v.minValue(0), v.maxValue(1))), null),
		createdAt: Timestamp
	}),
	v.check(
		(t) =>
			t.macroMode === 'percent'
				? t.proteinShare !== null &&
					t.carbShare !== null &&
					t.fatShare !== null &&
					Math.round((t.proteinShare + t.carbShare + t.fatShare) * 100) === 100
				: t.proteinShare === null && t.carbShare === null,
		'Own macro shares add up to 100 %'
	)
);

export const ProfileRecord = v.object({
	heightCm: v.nullable(v.pipe(v.number(), v.minValue(50), v.maxValue(260))),
	birthDate: v.nullable(DateString),
	sex: v.nullable(v.picklist(['female', 'male'])),
	bodyFatPct: v.nullable(v.pipe(v.number(), v.minValue(2), v.maxValue(75))),
	waistCm: v.nullable(v.pipe(v.number(), v.minValue(30), v.maxValue(250))),
	pregnant: v.boolean(),
	breastfeeding: v.boolean(),
	decimalMark: v.picklist([',', '.']),
	firstDayOfWeek: v.pipe(v.number(), v.integer(), v.minValue(1), v.maxValue(7))
});

export const DayCompletionRecord = v.object({
	localDate: DateString,
	source: v.picklist(['manual', 'loseit']),
	completedAt: Timestamp
});

export const AccountRecord = v.object({
	displayName: Text(80),
	profile: v.nullable(ProfileRecord)
});

// Files -----------------------------------------------------------------------------------------------------------

const DATA_FILES = {
	'data/account.json': AccountRecord,
	'data/foods.json': v.array(FoodRecord),
	'data/diary.json': v.array(DiaryRecord),
	'data/day-completions.json': v.array(DayCompletionRecord),
	'data/weight.json': v.array(WeightRecord),
	'data/water.json': v.array(WaterRecord),
	'data/activity.json': v.array(ActivityRecord),
	'data/targets.json': v.array(TargetRecord),
	'data/saved-meals.json': v.array(SavedMealRecord)
} as const;
/** Added to format version 1 later (2026-10-30): absent in older archives, read as empty. */
const OPTIONAL_FILES = new Set<string>(['data/saved-meals.json']);
const CSV_FILES = ['csv/diary.csv', 'csv/weight.csv', 'csv/water.csv', 'csv/activity.csv'] as const;

export interface PortableData {
	account: v.InferOutput<typeof AccountRecord>;
	foods: v.InferOutput<typeof FoodRecord>[];
	diary: v.InferOutput<typeof DiaryRecord>[];
	dayCompletions: v.InferOutput<typeof DayCompletionRecord>[];
	weight: v.InferOutput<typeof WeightRecord>[];
	water: v.InferOutput<typeof WaterRecord>[];
	activity: v.InferOutput<typeof ActivityRecord>[];
	targets: v.InferOutput<typeof TargetRecord>[];
	savedMeals: v.InferOutput<typeof SavedMealRecord>[];
}

const KEYS: Record<keyof typeof DATA_FILES, keyof PortableData> = {
	'data/account.json': 'account',
	'data/foods.json': 'foods',
	'data/diary.json': 'diary',
	'data/day-completions.json': 'dayCompletions',
	'data/weight.json': 'weight',
	'data/water.json': 'water',
	'data/activity.json': 'activity',
	'data/targets.json': 'targets',
	'data/saved-meals.json': 'savedMeals'
};

const Manifest = v.object({
	format: v.literal(FORMAT),
	formatVersion: v.literal(FORMAT_VERSION),
	exportedAt: Timestamp,
	sourceInstallation: Uuid,
	units: v.record(v.string(), v.string()),
	excluded: v.array(v.string()),
	files: v.array(
		v.object({
			path: v.string(),
			rows: v.pipe(v.number(), v.integer(), v.minValue(0)),
			sha256: v.pipe(v.string(), v.regex(/^[0-9a-f]{64}$/))
		})
	)
});
export type Manifest = v.InferOutput<typeof Manifest>;

export const UNITS = {
	energy: 'kcal',
	mass: 'g',
	volume: 'ml',
	bodyWeight: 'kg',
	nutrients: 'per food basis (100 g, 100 ml or one serving); entries hold their own totals',
	dates: 'local diary dates (YYYY-MM-DD) with the IANA time zone captured at entry'
};

export const sha256 = (bytes: Uint8Array) => createHash('sha256').update(bytes).digest('hex');

// CSV views: one row per record, the most useful columns; JSON stays the lossless format.
const cell = (value: unknown): string => {
	if (value === null || value === undefined) return '';
	const s = String(value);
	// Leading formula characters are quoted so a spreadsheet never runs them.
	const safe = /^[=+\-@\t\r]/.test(s) ? `'${s}` : s;
	return /[",\n\r]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe;
};
const csv = (header: string[], rows: unknown[][]) =>
	[header, ...rows].map((r) => r.map(cell).join(',')).join('\r\n') + '\r\n';

function csvViews(data: PortableData): Record<(typeof CSV_FILES)[number], string> {
	const trash = (d: string | null) => (d ? 'yes' : '');
	return {
		'csv/diary.csv': csv(
			[
				'date',
				'meal',
				'name',
				'amount',
				'unit',
				'kcal',
				'protein_g',
				'fat_g',
				'carbohydrate_excl_fibre_g',
				'in_trash'
			],
			data.diary.map((e) => [
				e.localDate,
				e.meal,
				e.food?.name ?? e.description ?? '',
				e.amount,
				e.unit
					? 'unit' in e.unit
						? e.unit.unit
						: 'name' in e.unit
							? e.unit.name
							: e.unit.kind
					: '',
				e.nutrients.energy_kcal?.value,
				e.nutrients.protein?.value,
				e.nutrients.fat?.value,
				e.nutrients.carbohydrate_excl_fibre?.value,
				trash(e.deletedAt)
			])
		),
		'csv/weight.csv': csv(
			['date', 'kg', 'in_trash'],
			data.weight.map((w) => [w.localDate, w.kg, trash(w.deletedAt)])
		),
		'csv/water.csv': csv(
			['date', 'ml', 'in_trash'],
			data.water.map((w) => [w.localDate, w.ml, trash(w.deletedAt)])
		),
		'csv/activity.csv': csv(
			['date', 'kcal', 'note', 'counts_toward_budget', 'in_trash'],
			data.activity.map((a) => [
				a.localDate,
				a.kcal,
				a.note,
				a.countsTowardBudget,
				trash(a.deletedAt)
			])
		)
	};
}

export function writeArchive(
	data: PortableData,
	meta: { exportedAt: string; sourceInstallation: string }
): Uint8Array {
	const files: Record<string, Uint8Array> = {};
	const listed: Manifest['files'] = [];
	for (const [path, key] of Object.entries(KEYS)) {
		const value = data[key];
		files[path] = strToU8(JSON.stringify(value, null, '\t'));
		listed.push({
			path,
			rows: Array.isArray(value) ? value.length : 1,
			sha256: sha256(files[path])
		});
	}
	const views = csvViews(data);
	for (const path of CSV_FILES) {
		files[path] = strToU8(views[path]);
		listed.push({ path, rows: views[path].split('\r\n').length - 2, sha256: sha256(files[path]) });
	}
	const manifest: Manifest = {
		format: FORMAT,
		formatVersion: FORMAT_VERSION,
		...meta,
		units: UNITS,
		excluded: EXCLUDED,
		files: listed
	};
	files['manifest.json'] = strToU8(JSON.stringify(manifest, null, '\t'));
	return zipSync(files, { level: 6, mtime: new Date(meta.exportedAt) });
}

export class ArchiveError extends Error {
	constructor(
		readonly code:
			| 'too_large'
			| 'not_an_archive'
			| 'unexpected_file'
			| 'missing_file'
			| 'unsupported_version'
			| 'checksum_mismatch'
			| 'invalid_content',
		readonly detail?: string
	) {
		super(detail ? `${code}: ${detail}` : code);
	}
}

const ALLOWED = new Set<string>(['manifest.json', ...Object.keys(DATA_FILES), ...CSV_FILES]);

/** Reads and validates an archive completely; throws ArchiveError without partial results. */
export function readArchive(bytes: Uint8Array): { manifest: Manifest; data: PortableData } {
	if (bytes.length > LIMITS.archiveBytes) throw new ArchiveError('too_large');
	let unpacked: Unzipped;
	let total = 0;
	let count = 0;
	try {
		unpacked = unzipSync(bytes, {
			// Checked against the declared sizes before anything is decompressed.
			filter: (file) => {
				if (file.name.endsWith('/')) return false;
				if (!ALLOWED.has(file.name)) throw new ArchiveError('unexpected_file', file.name);
				count += 1;
				total += file.originalSize;
				if (count > LIMITS.files || total > LIMITS.unpackedBytes)
					throw new ArchiveError('too_large');
				return true;
			}
		});
	} catch (e) {
		if (e instanceof ArchiveError) throw e;
		throw new ArchiveError('not_an_archive');
	}
	// The declared sizes could understate; check the real ones too.
	const real = Object.values(unpacked).reduce((n, f) => n + f.length, 0);
	if (real > LIMITS.unpackedBytes) throw new ArchiveError('too_large');

	const parse = (path: string): unknown => {
		const file = unpacked[path];
		if (!file) throw new ArchiveError('missing_file', path);
		try {
			return JSON.parse(strFromU8(file));
		} catch {
			throw new ArchiveError('invalid_content', path);
		}
	};
	const rawManifest = parse('manifest.json') as { format?: unknown; formatVersion?: unknown };
	if (rawManifest?.format !== FORMAT) throw new ArchiveError('not_an_archive');
	if (rawManifest.formatVersion !== FORMAT_VERSION) throw new ArchiveError('unsupported_version');
	const manifest = v.safeParse(Manifest, rawManifest);
	if (!manifest.success) throw new ArchiveError('invalid_content', 'manifest.json');

	const listed = new Map(manifest.output.files.map((f) => [f.path, f]));
	for (const path of Object.keys(unpacked)) {
		if (path === 'manifest.json') continue;
		const entry = listed.get(path);
		if (!entry) throw new ArchiveError('unexpected_file', path);
		if (sha256(unpacked[path]) !== entry.sha256) throw new ArchiveError('checksum_mismatch', path);
	}

	const data = {} as Record<keyof PortableData, unknown>;
	for (const [path, schema] of Object.entries(DATA_FILES)) {
		if (!listed.has(path)) {
			if (!OPTIONAL_FILES.has(path)) throw new ArchiveError('missing_file', path);
			data[KEYS[path as keyof typeof DATA_FILES]] = [];
			continue;
		}
		const raw = parse(path);
		if (Array.isArray(raw) && raw.length > LIMITS.rowsPerFile) throw new ArchiveError('too_large');
		const result = v.safeParse(schema, raw);
		if (!result.success) {
			const issue = result.issues[0];
			const at = issue.path?.map((p) => p.key).join('.') ?? '';
			throw new ArchiveError(
				'invalid_content',
				`${path}${at ? ` at ${at}` : ''}: ${issue.message}`
			);
		}
		data[KEYS[path as keyof typeof DATA_FILES]] = result.output;
	}
	return { manifest: manifest.output, data: data as PortableData };
}
