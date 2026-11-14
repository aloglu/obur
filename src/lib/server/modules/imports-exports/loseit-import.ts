// LoseIt import (docs/design.md, "LoseIt import and migration fidelity"): a dry run with counts, reconciliation and
// warnings, then an atomic apply that plans again inside its transaction.
//
// LoseIt rows carry no IDs, so a row's identity is its exact content plus its occurrence number among identical rows
// (two identical eggs at one breakfast stay two entries). A later, overlapping export therefore adds only rows not
// seen before. A row imported earlier that is missing from the new export was deleted or changed in LoseIt; the
// preview counts these and they move to the trash only when the person chooses so. Entries keep LoseIt's own
// totals; foods are private unless the person opts to share their custom foods; budgets become manual target
// versions from the dates they changed, only before the first target set in obur; activity is recorded, never
// counted toward the budget (its meaning is unmapped).
import { createHash, randomUUID } from 'node:crypto';
import { and, eq, inArray, isNull, sql } from 'drizzle-orm';
import type { Tx } from '../../db/identity.ts';
import type { EntryNutrients, FoodSnapshot, SnapshotUnit } from '../../../shared/diary-types.ts';
import {
	deriveNutrients,
	type NutrientCode,
	type NutrientValue
} from '../../../shared/nutrients.ts';
import { foldForSearch, foodSearchKey } from '../../../shared/search-text.ts';
import { activityEntries, waterEntries, weightEntries } from '../body/index.ts';
import { foodNutrients, foods } from '../catalog/index.ts';
import { dayCompletions, diaryEntries } from '../diary/index.ts';
import { goalVersions, profiles } from '../goals/index.ts';
import type { LoseItData, LoseItEntry, LoseItUnit } from './loseit.ts';
import { importFiles, importIdentities } from './schema.ts';

/** Stands for "LoseIt" as the source installation of every imported identity. */
export const LOSEIT_SOURCE = '10e5e17e-0000-4000-8000-000000000001';
const LB_TO_KG = 0.45359237;

export interface LoseItOptions {
	/** The zone the entries were made in (LoseIt exports none). */
	zone: string;
	/** LoseIt's weights have no unit column. */
	weightUnit: 'kg' | 'lb';
	/** Share the person's custom foods with other members (imported foods are private by default). */
	shareFoods: boolean;
	/** Move entries imported earlier but missing from this export to the trash. */
	trashMissing: boolean;
}

type Kind = 'food' | 'diary' | 'weight' | 'water' | 'activity' | 'target';
export interface LoseItCounts {
	new: number;
	unchanged: number;
	/** Imported before, but not in this export (deleted or changed in LoseIt). */
	missing: number;
	skipped: number;
}
export type LoseItWarning =
	| 'already_imported'
	| 'missing_rows'
	| 'reconciliation_mismatch'
	| 'budgets_after_own_target'
	| 'profile_kept'
	| 'height_out_of_range';

export interface LoseItSummary {
	source: 'loseit';
	alreadyImported: boolean;
	dateRange: { from: string; to: string } | null;
	counts: Record<Kind | 'dayCompletion' | 'profile', LoseItCounts>;
	deletedInLoseIt: number;
	/** The earliest weigh-in as written in the file (it has no unit), so the person can tell which unit it is in. */
	firstWeight: number | null;
	/** Days whose imported entries do not add up to LoseIt's own daily food total (should be none). */
	reconciliation: { days: number; mismatched: string[] };
	warnings: LoseItWarning[];
	options: LoseItOptions;
}

const sha = (text: string) => createHash('sha256').update(text).digest('hex').slice(0, 40);
const empty = (): LoseItCounts => ({ new: 0, unchanged: 0, missing: 0, skipped: 0 });

/** Identity per row: content hash plus occurrence among identical rows, in file order. */
function identities<T>(rows: T[], content: (row: T) => string): string[] {
	const seen = new Map<string, number>();
	return rows.map((row) => {
		const hash = sha(content(row));
		const n = (seen.get(hash) ?? 0) + 1;
		seen.set(hash, n);
		return `${hash}#${n}`;
	});
}

const values = (n: EntryNutrients): NutrientValue[] =>
	Object.entries(n).map(([code, v]) => ({
		code: code as NutrientCode,
		value: v!.value,
		qualifier: v!.qualifier
	}));
const entryNutrients = (list: NutrientValue[]): EntryNutrients =>
	Object.fromEntries(list.map((v) => [v.code, { value: v.value, qualifier: v.qualifier }]));
/** Salt from sodium as a documented derivation (sodium is kept). */
const withDerived = (n: EntryNutrients) => entryNutrients(deriveNutrients(values(n)));

const portion = (quantity: number, unit: LoseItUnit) =>
	`${Number(quantity.toFixed(4))} ${unit.kind === 'count' ? unit.label : unit.unit}`;

/** A diary snapshot for a row: one basis serving is the logged amount; grams and millilitres can be re-scaled. */
function snapshotFor(e: LoseItEntry): { food: FoodSnapshot; amount: number; unit: SnapshotUnit } {
	const physical = e.unit.kind !== 'count';
	const food: FoodSnapshot = {
		name: e.name.slice(0, 200),
		brand: null,
		basis: 'serving',
		servingLabel: portion(e.quantity, e.unit).slice(0, 200),
		servingSize: physical
			? { amount: e.quantity, unit: e.unit.kind === 'mass' ? 'g' : 'ml' }
			: null,
		servings: [],
		basisNutrients: values(withDerived(e.nutrients))
	};
	if (e.unit.kind === 'mass')
		return { food, amount: e.quantity, unit: { kind: 'mass', unit: 'g' } };
	if (e.unit.kind === 'volume')
		return { food, amount: e.quantity, unit: { kind: 'volume', unit: 'ml' } };
	return { food, amount: 1, unit: { kind: 'basis_serving' } };
}

interface Planned {
	summary: LoseItSummary;
	/** Source ID → local ID, per kind, for rows to create. */
	create: Record<Kind, Map<string, string>>;
	/** Local IDs of earlier imports missing from this export, per kind. */
	missing: Record<'diary' | 'weight' | 'water' | 'activity', string[]>;
	/** Source food key → local food ID, for diary links. */
	foodLinks: Map<string, string>;
	ids: {
		entries: string[];
		weights: string[];
		water: string[];
		activity: string[];
	};
	budgetChanges: { date: string; kcal: number; id: string }[];
	completions: string[];
	importProfile: boolean;
}

const foodKeyFor = (data: LoseItData) => {
	const byName = new Map<string, string[]>();
	for (const f of data.foods) {
		const k = foldForSearch(f.name);
		byName.set(k, [...(byName.get(k) ?? []), f.uniqueId]);
	}
	/** A diary row links to the custom food with its exact name, if exactly one; otherwise to its own log food. */
	return (name: string) => {
		const matches = byName.get(foldForSearch(name));
		return matches?.length === 1
			? `custom:${matches[0]}`
			: matches
				? null
				: `log:${foldForSearch(name)}`;
	};
};

export async function planLoseIt(
	tx: Tx,
	userId: string,
	data: LoseItData,
	file: { sha: string },
	options: LoseItOptions
): Promise<Planned> {
	const warnings = new Set<LoseItWarning>();
	const counts = Object.fromEntries(
		(
			[
				'food',
				'diary',
				'weight',
				'water',
				'activity',
				'target',
				'dayCompletion',
				'profile'
			] as const
		).map((k) => [k, empty()])
	) as LoseItSummary['counts'];

	const [repeat] = await tx
		.select({ sha: importFiles.sha256 })
		.from(importFiles)
		.where(and(eq(importFiles.userId, userId), eq(importFiles.sha256, file.sha)));
	if (repeat) warnings.add('already_imported');

	const known = new Map<string, string>();
	for (const r of await tx
		.select()
		.from(importIdentities)
		.where(
			and(eq(importIdentities.userId, userId), eq(importIdentities.sourceInstall, LOSEIT_SOURCE))
		)) {
		known.set(`${r.kind}:${r.sourceId}`, r.localId);
	}
	const create = {
		food: new Map<string, string>(),
		diary: new Map<string, string>(),
		weight: new Map<string, string>(),
		water: new Map<string, string>(),
		activity: new Map<string, string>(),
		target: new Map<string, string>()
	};
	const decide = (kind: Kind, sourceId: string) => {
		if (known.has(`${kind}:${sourceId}`)) {
			counts[kind].unchanged++;
			return known.get(`${kind}:${sourceId}`)!;
		}
		const id = create[kind].get(sourceId) ?? randomUUID();
		if (!create[kind].has(sourceId)) {
			create[kind].set(sourceId, id);
			counts[kind].new++;
		}
		return id;
	};

	// Foods: custom foods, and one private food per LoseIt database food seen in the diary (from its latest row).
	const foodKey = foodKeyFor(data);
	const foodLinks = new Map<string, string>();
	for (const f of data.foods)
		foodLinks.set(`custom:${f.uniqueId}`, decide('food', `custom:${f.uniqueId}`));
	for (const e of data.entries) {
		const k = foodKey(e.name);
		if (k?.startsWith('log:') && !foodLinks.has(k)) foodLinks.set(k, decide('food', k));
	}

	// Rows with identities; earlier imports missing from this export are counted, within the export's date range.
	const ids = {
		entries: identities(data.entries, (e) => e.fingerprint),
		weights: identities(data.weights, (w) => w.fingerprint),
		water: data.water.map((w) => `${w.date}:${w.ml}`),
		activity: identities(data.activity, (a) => a.fingerprint)
	};
	ids.entries.forEach((id) => decide('diary', id));
	ids.weights.forEach((id) => decide('weight', id));
	ids.water.forEach((id) => decide('water', id));
	ids.activity.forEach((id) => decide('activity', id));

	const dates = [...data.entries, ...data.weights, ...data.water, ...data.activity]
		.map((r) => r.date)
		.sort();
	const dateRange = dates.length ? { from: dates[0], to: dates.at(-1)! } : null;
	const missing = {
		diary: [] as string[],
		weight: [] as string[],
		water: [] as string[],
		activity: [] as string[]
	};
	if (dateRange) {
		const tables = {
			diary: diaryEntries,
			weight: weightEntries,
			water: waterEntries,
			activity: activityEntries
		};
		const present = {
			diary: new Set(ids.entries),
			weight: new Set(ids.weights),
			water: new Set(ids.water),
			activity: new Set(ids.activity)
		};
		for (const kind of ['diary', 'weight', 'water', 'activity'] as const) {
			const earlier = [...known.entries()]
				.filter(([k]) => k.startsWith(`${kind}:`) && !present[kind].has(k.slice(kind.length + 1)))
				.map(([, localId]) => localId);
			if (!earlier.length) continue;
			const table = tables[kind];
			const live = await tx
				.select({ id: table.id, date: table.localDate })
				.from(table)
				.where(and(inArray(table.id, earlier), isNull(table.deletedAt)));
			missing[kind] = live
				.filter((r) => r.date >= dateRange.from && r.date <= dateRange.to)
				.map((r) => r.id);
			counts[kind].missing = missing[kind].length;
		}
		if (Object.values(missing).some((m) => m.length)) warnings.add('missing_rows');
	}

	// Budgets: a manual target version wherever LoseIt's budget changed, before the first target set in obur.
	const [own] = await tx
		.select({ from: sql<string | null>`min(${goalVersions.effectiveFrom})` })
		.from(goalVersions)
		.where(
			and(
				eq(goalVersions.userId, userId),
				sql`coalesce(${goalVersions.inputs}->>'source', '') <> 'loseit'`
			)
		);
	const budgetChanges: Planned['budgetChanges'] = [];
	let previous: number | null = null;
	for (const day of [...data.days].sort((a, b) => a.date.localeCompare(b.date))) {
		if (day.budgetKcal === null || day.budgetKcal === previous) continue;
		previous = day.budgetKcal;
		if (day.budgetKcal < 500 || day.budgetKcal > 10_000) {
			counts.target.skipped++;
			continue;
		}
		if (own?.from && day.date >= own.from) {
			counts.target.skipped++;
			warnings.add('budgets_after_own_target');
			continue;
		}
		budgetChanges.push({
			date: day.date,
			kcal: day.budgetKcal,
			id: decide('target', `budget:${day.date}:${day.budgetKcal}`)
		});
	}

	const completedHere = new Set(
		(
			await tx
				.select({ d: dayCompletions.localDate })
				.from(dayCompletions)
				.where(eq(dayCompletions.userId, userId))
		).map((r) => r.d)
	);
	const completions = data.completed.filter((d) => !completedHere.has(d));
	counts.dayCompletion = {
		new: completions.length,
		unchanged: data.completed.length - completions.length,
		missing: 0,
		skipped: 0
	};

	const [profile] = await tx
		.select({ userId: profiles.userId })
		.from(profiles)
		.where(eq(profiles.userId, userId));
	const hasProfileData = !!(data.profile.birthDate || data.profile.sex || data.profile.height);
	const importProfile = hasProfileData && !profile;
	if (hasProfileData) {
		if (importProfile) counts.profile.new = 1;
		else {
			counts.profile.skipped = 1;
			warnings.add('profile_kept');
		}
	}
	if (
		importProfile &&
		data.profile.height !== null &&
		(data.profile.height < 50 || data.profile.height > 260)
	)
		warnings.add('height_out_of_range');

	// Reconciliation: imported rows against LoseIt's own daily food totals.
	const sums = new Map<string, number>();
	for (const e of data.entries)
		sums.set(e.date, (sums.get(e.date) ?? 0) + (e.nutrients.energy_kcal?.value ?? 0));
	const mismatched = data.days
		.filter((d) => Math.abs((sums.get(d.date) ?? 0) - d.foodKcal) >= 1)
		.map((d) => d.date);
	if (mismatched.length) warnings.add('reconciliation_mismatch');

	return {
		summary: {
			source: 'loseit',
			alreadyImported: !!repeat,
			dateRange,
			counts,
			deletedInLoseIt: data.deletedEntries,
			firstWeight:
				data.weights.reduce<{ date: string; value: number } | null>(
					(first, w) => (!first || w.date < first.date ? w : first),
					null
				)?.value ?? null,
			reconciliation: { days: data.days.length, mismatched },
			warnings: [...warnings],
			options
		},
		create,
		missing,
		foodLinks,
		ids,
		budgetChanges,
		completions,
		importProfile
	};
}

export async function writeLoseIt(
	tx: Tx,
	userId: string,
	data: LoseItData,
	p: Planned,
	options: LoseItOptions
) {
	const now = Date.now();
	const chunked = async <T>(rows: T[], insert: (chunk: T[]) => Promise<unknown>) => {
		for (let i = 0; i < rows.length; i += 500) await insert(rows.slice(i, i + 500));
	};
	const identities: (typeof importIdentities.$inferInsert)[] = [];
	const remember = (kind: Kind, sourceId: string, localId: string) =>
		identities.push({
			userId,
			sourceInstall: LOSEIT_SOURCE,
			kind,
			sourceId: sourceId.slice(0, 100),
			localId
		});

	// Foods.
	const foodRows: (typeof foods.$inferInsert)[] = [];
	const nutrientRows: (typeof foodNutrients.$inferInsert)[] = [];
	const addFood = (
		sourceId: string,
		f: {
			name: string;
			brand: string | null;
			quantity: number;
			unit: LoseItUnit;
			nutrients: EntryNutrients;
		},
		shared: boolean,
		meta: Record<string, unknown>
	) => {
		const id = p.create.food.get(sourceId);
		if (!id) return;
		const per100 =
			f.quantity === 100 && f.unit.kind !== 'count'
				? f.unit.kind === 'mass'
					? '100g'
					: '100ml'
				: null;
		foodRows.push({
			id,
			ownerId: userId,
			visibility: shared ? 'shared' : 'private',
			name: f.name.slice(0, 200),
			brand: f.brand?.slice(0, 120) || null,
			searchKey: foodSearchKey(f.name, f.brand),
			basis: per100 ?? 'serving',
			servingLabel: per100 ? null : portion(f.quantity, f.unit).slice(0, 200),
			servingAmount: per100 || f.unit.kind === 'count' ? null : f.quantity,
			servingUnit: per100 || f.unit.kind === 'count' ? null : f.unit.kind === 'mass' ? 'g' : 'ml',
			origin: 'loseit',
			sourceMeta: meta
		});
		for (const v of deriveNutrients(values(f.nutrients))) nutrientRows.push({ foodId: id, ...v });
		remember('food', sourceId, id);
	};
	for (const f of data.foods)
		addFood(`custom:${f.uniqueId}`, f, options.shareFoods, {
			loseit: 'custom food',
			uniqueId: f.uniqueId
		});
	const latest = new Map<string, LoseItEntry>();
	for (const e of data.entries) {
		const k = `log:${foldForSearch(e.name)}`;
		if (p.create.food.has(k) && (!latest.has(k) || latest.get(k)!.date <= e.date)) latest.set(k, e);
	}
	for (const [k, e] of latest)
		addFood(
			k,
			{ name: e.name, brand: null, quantity: e.quantity, unit: e.unit, nutrients: e.nutrients },
			false,
			{
				loseit: 'database food, from its latest diary row'
			}
		);
	await chunked(foodRows, (c) => tx.insert(foods).values(c));
	await chunked(nutrientRows, (c) => tx.insert(foodNutrients).values(c));

	// Diary entries, in file order within each day.
	const foodKey = foodKeyFor(data);
	const entryRows: (typeof diaryEntries.$inferInsert)[] = [];
	data.entries.forEach((e, i) => {
		const id = p.create.diary.get(p.ids.entries[i]);
		if (!id) return;
		const snap = snapshotFor(e);
		const k = foodKey(e.name);
		entryRows.push({
			id,
			userId,
			localDate: e.date,
			meal: e.meal,
			zone: options.zone,
			kind: 'food',
			foodId: k ? (p.foodLinks.get(k) ?? null) : null,
			food: snap.food,
			amount: snap.amount,
			unit: snap.unit,
			description: null,
			nutrients: withDerived(e.nutrients),
			createdAt: new Date(now + i),
			updatedAt: new Date(now + i)
		});
		remember('diary', p.ids.entries[i], id);
	});
	await chunked(entryRows, (c) => tx.insert(diaryEntries).values(c));

	const reading = (id: string, date: string) => ({
		id,
		userId,
		localDate: date,
		zone: options.zone,
		source: 'loseit' as const
	});
	const weightRows = data.weights.flatMap((w, i) => {
		const id = p.create.weight.get(p.ids.weights[i]);
		if (!id) return [];
		remember('weight', p.ids.weights[i], id);
		const kg = options.weightUnit === 'lb' ? w.value * LB_TO_KG : w.value;
		return [{ ...reading(id, w.date), kg: Math.round(kg * 100) / 100 }];
	});
	await chunked(weightRows, (c) => tx.insert(weightEntries).values(c));
	const waterRows = data.water.flatMap((w, i) => {
		const id = p.create.water.get(p.ids.water[i]);
		if (!id) return [];
		remember('water', p.ids.water[i], id);
		return [{ ...reading(id, w.date), ml: Math.min(w.ml, 10_000) }];
	});
	await chunked(waterRows, (c) => tx.insert(waterEntries).values(c));
	const activityRows = data.activity.flatMap((a, i) => {
		const id = p.create.activity.get(p.ids.activity[i]);
		if (!id || a.kcal > 10_000) return [];
		remember('activity', p.ids.activity[i], id);
		return [
			{
				...reading(id, a.date),
				kcal: a.kcal,
				note: a.name.slice(0, 120),
				countsTowardBudget: false
			}
		];
	});
	await chunked(activityRows, (c) => tx.insert(activityEntries).values(c));

	// Budgets as manual target versions (a manual budget is the budget for an inactive day).
	const targets = p.budgetChanges.filter((b) => p.create.target.has(`budget:${b.date}:${b.kcal}`));
	await chunked(targets, (c) =>
		tx.insert(goalVersions).values(
			c.map((b) => ({
				id: b.id,
				userId,
				effectiveFrom: b.date,
				mode: 'manual' as const,
				baseBurnKcal: b.kcal,
				inputs: { source: 'loseit' },
				calculationVersion: 'loseit-import'
			}))
		)
	);
	targets.forEach((b) => remember('target', `budget:${b.date}:${b.kcal}`, b.id));

	await chunked(p.completions, (c) =>
		tx
			.insert(dayCompletions)
			.values(c.map((d) => ({ userId, localDate: d, source: 'loseit' as const })))
	);
	if (p.importProfile) {
		const h = data.profile.height;
		await tx.insert(profiles).values({
			userId,
			birthDate: data.profile.birthDate,
			sex: data.profile.sex,
			heightCm: h !== null && h >= 50 && h <= 260 ? Math.round(h * 10) / 10 : null
		});
	}

	if (options.trashMissing) {
		const at = new Date(now);
		const tables = {
			diary: diaryEntries,
			weight: weightEntries,
			water: waterEntries,
			activity: activityEntries
		};
		for (const kind of ['diary', 'weight', 'water', 'activity'] as const) {
			const ids = p.missing[kind];
			if (ids.length) {
				const table = tables[kind];
				await tx
					.update(table)
					.set({ deletedAt: at, updatedAt: at, revision: sql`${table.revision} + 1` })
					.where(inArray(table.id, ids));
			}
		}
	}
	await chunked(identities, (c) => tx.insert(importIdentities).values(c).onConflictDoNothing());
}
