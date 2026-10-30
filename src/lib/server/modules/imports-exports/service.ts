// Personal export, import and account deletion (docs/design.md, "Your data: export, import and deletion"). This
// module maps the portable archive to the tables of the diary, body, goals and catalog modules through their public
// schema exports, inside one transaction per operation, so an import is never partly committed.
//
// Import policy (overlapping history): every record is matched by its source identity, which is the record ID from
// the exporting installation. A record imported before (import_identities), or one that is already in this account
// on the same installation, is "unchanged" when its content matches and "changed" otherwise; changed records keep
// the current version (shown in the preview). Everything else is new and gets a new ID, so repeated identical meals
// stay separate entries. Imported foods are private. Target versions are added only to an account without targets of
// its own, and a profile only to an account without one, so imported history never changes existing budgets.
import { randomUUID } from 'node:crypto';
import { and, eq, inArray, sql } from 'drizzle-orm';
import { withUser, type Database, type Tx } from '../../db/identity.ts';
import { foodSearchKey } from '../../../shared/search-text.ts';
import { users } from '../auth/index.ts';
import { activityEntries, waterEntries, weightEntries } from '../body/index.ts';
import { foodNutrients, foods, foodServings } from '../catalog/index.ts';
import { dayCompletions, diaryEntries, savedMealItems, savedMeals } from '../diary/index.ts';
import { goalVersions, profiles } from '../goals/index.ts';
import { readArchive, sha256, writeArchive, type PortableData } from './archive.ts';
import { readLoseItArchive } from './loseit.ts';
import {
	planLoseIt,
	writeLoseIt,
	type LoseItOptions,
	type LoseItSummary
} from './loseit-import.ts';
import { accountDeletions, importFiles, importIdentities, installation } from './schema.ts';

export class PortabilityError extends Error {
	constructor(readonly code: 'already_imported' | 'last_admin' | 'not_found' | 'forbidden') {
		super(code);
	}
}

type IdKind = 'food' | 'diary' | 'weight' | 'water' | 'activity' | 'target' | 'saved_meal';
type CountKind = IdKind | 'dayCompletion' | 'profile';
export interface Counts {
	new: number;
	unchanged: number;
	changed: number;
	skipped: number;
}
export type ImportWarning =
	'already_imported' | 'changed_kept' | 'targets_kept' | 'profile_kept' | 'food_links_dropped';

export interface ImportSummary {
	sourceInstallation: string;
	sameInstallation: boolean;
	exportedAt: string;
	alreadyImported: boolean;
	dateRange: { from: string; to: string } | null;
	counts: Record<CountKind, Counts>;
	warnings: ImportWarning[];
}

const iso = (d: Date | null) => (d ? d.toISOString() : null);
/** Key order does not matter when comparing stored JSON with archive JSON. */
const canonical = (value: unknown): string =>
	JSON.stringify(value, (_k, v) =>
		v && typeof v === 'object' && !Array.isArray(v)
			? Object.fromEntries(Object.entries(v).sort(([a], [b]) => a.localeCompare(b)))
			: v
	);

async function installationId(tx: Tx): Promise<string> {
	const [row] = await tx.select({ id: installation.id }).from(installation);
	return row.id;
}

// Export ----------------------------------------------------------------------------------------------------------

async function collect(tx: Tx, userId: string): Promise<PortableData> {
	const [me] = await tx.select().from(users).where(eq(users.id, userId));
	const [profile] = await tx.select().from(profiles).where(eq(profiles.userId, userId));
	const diary = await tx.select().from(diaryEntries).where(eq(diaryEntries.userId, userId));
	const meals = await tx.select().from(savedMeals).where(eq(savedMeals.userId, userId));
	const mealItems = await tx
		.select()
		.from(savedMealItems)
		.where(eq(savedMealItems.userId, userId))
		.orderBy(savedMealItems.position);

	// The person's own foods, plus every food their diary and saved meals refer to and the foods those were derived from, as far
	// as they can see them (RLS): enough to interpret and reuse their data.
	const wanted = new Set<string>();
	const owned = await tx.select({ id: foods.id }).from(foods).where(eq(foods.ownerId, userId));
	owned.forEach((f) => wanted.add(f.id));
	diary.forEach((e) => e.foodId && wanted.add(e.foodId));
	mealItems.forEach((i) => i.foodId && wanted.add(i.foodId));
	let foodRows: (typeof foods.$inferSelect)[] = [];
	let pending = [...wanted];
	while (pending.length) {
		const rows = await tx.select().from(foods).where(inArray(foods.id, pending));
		foodRows = [...foodRows, ...rows];
		pending = rows.map((r) => r.derivedFrom).filter((id): id is string => !!id && !wanted.has(id));
		pending.forEach((id) => wanted.add(id));
	}
	const ids = foodRows.map((f) => f.id);
	const nutrients = ids.length
		? await tx.select().from(foodNutrients).where(inArray(foodNutrients.foodId, ids))
		: [];
	const servings = ids.length
		? await tx.select().from(foodServings).where(inArray(foodServings.foodId, ids))
		: [];
	const exported = new Set(ids);

	const lifecycle = (r: {
		revision: number;
		createdAt: Date;
		updatedAt: Date;
		deletedAt: Date | null;
	}) => ({
		revision: r.revision,
		createdAt: r.createdAt.toISOString(),
		updatedAt: r.updatedAt.toISOString(),
		deletedAt: iso(r.deletedAt)
	});
	const reading = <R extends typeof weightEntries.$inferSelect | typeof waterEntries.$inferSelect>(
		r: R
	) => ({ id: r.id, localDate: r.localDate, zone: r.zone, source: r.source, ...lifecycle(r) });

	return {
		account: {
			displayName: me.displayName,
			profile: profile
				? {
						heightCm: profile.heightCm,
						birthDate: profile.birthDate,
						sex: profile.sex,
						bodyFatPct: profile.bodyFatPct,
						waistCm: profile.waistCm,
						pregnant: profile.pregnant,
						breastfeeding: profile.breastfeeding,
						decimalMark: profile.decimalMark,
						firstDayOfWeek: profile.firstDayOfWeek
					}
				: null
		},
		foods: foodRows.map((f) => {
			const mine = f.ownerId === userId;
			return {
				id: f.id,
				mine,
				visibility: f.visibility,
				name: f.name,
				brand: f.brand,
				basis: f.basis,
				servingLabel: f.servingLabel,
				servingAmount: f.servingAmount,
				servingUnit: f.servingUnit,
				barcode: f.barcode,
				origin: f.origin,
				// Provenance of someone else's food is not the exporting person's to take along.
				sourceMeta: mine ? ((f.sourceMeta as Record<string, unknown> | null) ?? null) : null,
				derivedFrom: f.derivedFrom && exported.has(f.derivedFrom) ? f.derivedFrom : null,
				archivedAt: iso(f.archivedAt),
				createdAt: f.createdAt.toISOString(),
				updatedAt: f.updatedAt.toISOString(),
				nutrients: nutrients
					.filter((n) => n.foodId === f.id)
					.map((n) => ({ code: n.code as never, value: n.value, qualifier: n.qualifier })),
				servings: servings
					.filter((s) => s.foodId === f.id)
					.map((s) => ({
						id: s.id,
						name: s.name,
						amount: s.amount,
						unit: s.unit,
						source: s.source
					}))
			};
		}),
		diary: diary.map((e) => ({
			id: e.id,
			localDate: e.localDate,
			meal: e.meal,
			zone: e.zone,
			eatenAt: iso(e.eatenAt),
			kind: e.kind,
			foodId: e.foodId,
			food: e.food,
			amount: e.amount,
			unit: e.unit,
			description: e.description,
			nutrients: e.nutrients as never,
			...lifecycle(e)
		})),
		dayCompletions: (
			await tx.select().from(dayCompletions).where(eq(dayCompletions.userId, userId))
		).map((d) => ({
			localDate: d.localDate,
			source: d.source,
			completedAt: d.completedAt.toISOString()
		})),
		weight: (await tx.select().from(weightEntries).where(eq(weightEntries.userId, userId))).map(
			(w) => ({
				...reading(w),
				measuredAt: iso(w.measuredAt),
				kg: w.kg
			})
		),
		water: (await tx.select().from(waterEntries).where(eq(waterEntries.userId, userId))).map(
			(w) => ({
				...reading(w),
				ml: w.ml
			})
		),
		activity: (
			await tx.select().from(activityEntries).where(eq(activityEntries.userId, userId))
		).map((a) => ({
			id: a.id,
			localDate: a.localDate,
			zone: a.zone,
			source: a.source,
			...lifecycle(a),
			kcal: a.kcal,
			note: a.note,
			countsTowardBudget: a.countsTowardBudget,
			kind: a.kind
		})),
		targets: (await tx.select().from(goalVersions).where(eq(goalVersions.userId, userId))).map(
			(t) => ({
				id: t.id,
				effectiveFrom: t.effectiveFrom,
				mode: t.mode,
				baseBurnKcal: t.baseBurnKcal,
				deficitKcal: t.deficitKcal,
				floorKcal: t.floorKcal,
				goalWeightKg: t.goalWeightKg,
				rateKgPerWeek: t.rateKgPerWeek,
				proteinGPerKg: t.proteinGPerKg,
				proteinBasisKg: t.proteinBasisKg,
				fatShare: t.fatShare,
				inputs: t.inputs as Record<string, unknown>,
				calculationVersion: t.calculationVersion,
				countActivity: t.countActivity,
				atGoal: t.atGoal,
				createdAt: t.createdAt.toISOString()
			})
		),
		savedMeals: meals.map((sm) => ({
			id: sm.id,
			name: sm.name,
			revision: sm.revision,
			createdAt: sm.createdAt.toISOString(),
			updatedAt: sm.updatedAt.toISOString(),
			items: mealItems
				.filter((i) => i.savedMealId === sm.id)
				.map((i) => ({
					kind: i.kind,
					foodId: i.foodId,
					food: i.food,
					amount: i.amount,
					unit: i.unit,
					description: i.description,
					nutrients: i.nutrients as never
				}))
		}))
	};
}

// Import ----------------------------------------------------------------------------------------------------------

type Decision =
	{ status: 'new'; localId: string } | { status: 'unchanged' | 'changed'; localId: string };

interface Plan {
	summary: ImportSummary;
	decisions: Map<string, Decision>;
	/** Source food ID → local food ID for diary links and variants (existing or to be created). */
	foodMap: Map<string, string>;
	importTargets: boolean;
	importProfile: boolean;
	newCompletions: PortableData['dayCompletions'];
}

const key = (kind: IdKind, id: string) => `${kind}:${id}`;
const emptyCounts = (): Counts => ({ new: 0, unchanged: 0, changed: 0, skipped: 0 });

async function plan(
	tx: Tx,
	userId: string,
	file: { sha: string; sourceInstallation: string; exportedAt: string },
	data: PortableData
): Promise<Plan> {
	const here = await installationId(tx);
	const same = file.sourceInstallation === here;
	const counts = Object.fromEntries(
		(
			[
				'food',
				'diary',
				'weight',
				'water',
				'activity',
				'target',
				'saved_meal',
				'dayCompletion',
				'profile'
			] as const
		).map((k) => [k, emptyCounts()])
	) as Record<CountKind, Counts>;
	const warnings = new Set<ImportWarning>();
	const decisions = new Map<string, Decision>();

	const [repeat] = await tx
		.select({ sha: importFiles.sha256 })
		.from(importFiles)
		.where(and(eq(importFiles.userId, userId), eq(importFiles.sha256, file.sha)));
	if (repeat) warnings.add('already_imported');

	const identities = new Map(
		(
			await tx
				.select()
				.from(importIdentities)
				.where(
					and(
						eq(importIdentities.userId, userId),
						eq(importIdentities.sourceInstall, file.sourceInstallation)
					)
				)
		).map((r) => [key(r.kind, r.sourceId), r.localId])
	);

	/** Finds where a source record already lives in this account: via an earlier import, or the same ID here. */
	async function locate<T extends { id: string }>(
		kind: IdKind,
		records: T[],
		load: (ids: string[]) => Promise<{ id: string }[]>
	): Promise<Map<string, string>> {
		const found = new Map<string, string>();
		for (const r of records) {
			const mapped = identities.get(key(kind, r.id));
			if (mapped) found.set(r.id, mapped);
		}
		if (same) {
			const unmapped = records.filter((r) => !found.has(r.id)).map((r) => r.id);
			for (let i = 0; i < unmapped.length; i += 1000) {
				for (const row of await load(unmapped.slice(i, i + 1000))) found.set(row.id, row.id);
			}
		}
		return found;
	}

	async function decide<T extends { id: string }, R extends { id: string }>(
		kind: IdKind,
		records: T[],
		table: { load: (ids: string[]) => Promise<R[]> },
		matches: (source: T, local: R) => boolean
	) {
		const located = await locate(kind, records, (ids) => table.load(ids));
		const localIds = [...new Set(located.values())];
		const locals = new Map<string, R>();
		for (let i = 0; i < localIds.length; i += 1000) {
			for (const row of await table.load(localIds.slice(i, i + 1000))) locals.set(row.id, row);
		}
		for (const r of records) {
			const localId = located.get(r.id);
			const local = localId ? locals.get(localId) : undefined;
			if (!local) {
				decisions.set(key(kind, r.id), { status: 'new', localId: randomUUID() });
				counts[kind].new += 1;
			} else {
				const status = matches(r, local) ? 'unchanged' : 'changed';
				decisions.set(key(kind, r.id), { status, localId: local.id });
				counts[kind][status] += 1;
				if (status === 'changed') warnings.add('changed_kept');
			}
		}
	}

	// Foods: the person's own become private copies; foods someone else shared map to the same food when it is
	// still visible here, otherwise they become private copies too.
	const foodMap = new Map<string, string>();
	const ownFoods = data.foods.filter((f) => f.mine);
	const sharedFoods = data.foods.filter((f) => !f.mine);
	const foodContent = (f: { name: string; brand: string | null; basis: string }, n: unknown) =>
		canonical([f.name, f.brand, f.basis, n]);
	const loadFoods = async (ids: string[]) => {
		const rows = await tx.select().from(foods).where(inArray(foods.id, ids));
		const values = rows.length
			? await tx
					.select()
					.from(foodNutrients)
					.where(
						inArray(
							foodNutrients.foodId,
							rows.map((r) => r.id)
						)
					)
			: [];
		return rows.map((r) => ({
			...r,
			nutrients: values
				.filter((n) => n.foodId === r.id)
				.map((n) => ({ code: n.code, value: n.value, qualifier: n.qualifier }))
				.sort((a, b) => a.code.localeCompare(b.code))
		}));
	};
	const sortedNutrients = (f: PortableData['foods'][number]) =>
		[...f.nutrients].sort((a, b) => a.code.localeCompare(b.code));
	await decide(
		'food',
		ownFoods,
		{ load: async (ids) => (await loadFoods(ids)).filter((r) => r.ownerId === userId) },
		(s, l) => foodContent(s, sortedNutrients(s)) === foodContent(l, l.nutrients)
	);
	if (sharedFoods.length) {
		const visible = same
			? new Set(
					(
						await tx
							.select({ id: foods.id })
							.from(foods)
							.where(
								inArray(
									foods.id,
									sharedFoods.map((f) => f.id)
								)
							)
					).map((r) => r.id)
				)
			: new Set<string>();
		const copies = sharedFoods.filter((f) => !visible.has(f.id));
		for (const f of sharedFoods.filter((f) => visible.has(f.id))) {
			decisions.set(key('food', f.id), { status: 'unchanged', localId: f.id });
			counts.food.unchanged += 1;
		}
		await decide(
			'food',
			copies,
			{ load: async (ids) => (await loadFoods(ids)).filter((r) => r.ownerId === userId) },
			(s, l) => foodContent(s, sortedNutrients(s)) === foodContent(l, l.nutrients)
		);
	}
	for (const f of data.foods) foodMap.set(f.id, decisions.get(key('food', f.id))!.localId);
	if (
		[...data.diary, ...data.savedMeals.flatMap((sm) => sm.items)].some(
			(e) => e.foodId && !foodMap.has(e.foodId)
		)
	)
		warnings.add('food_links_dropped');

	const deleted = (d: Date | null | string) => d !== null;
	await decide(
		'diary',
		data.diary,
		{
			load: (ids) =>
				tx
					.select()
					.from(diaryEntries)
					.where(and(eq(diaryEntries.userId, userId), inArray(diaryEntries.id, ids)))
		},
		(s, l) =>
			canonical([
				s.localDate,
				s.meal,
				s.amount,
				s.description,
				s.nutrients,
				deleted(s.deletedAt)
			]) ===
			canonical([l.localDate, l.meal, l.amount, l.description, l.nutrients, deleted(l.deletedAt)])
	);
	await decide(
		'weight',
		data.weight,
		{
			load: (ids) =>
				tx
					.select()
					.from(weightEntries)
					.where(and(eq(weightEntries.userId, userId), inArray(weightEntries.id, ids)))
		},
		(s, l) =>
			s.localDate === l.localDate && s.kg === l.kg && deleted(s.deletedAt) === deleted(l.deletedAt)
	);
	await decide(
		'water',
		data.water,
		{
			load: (ids) =>
				tx
					.select()
					.from(waterEntries)
					.where(and(eq(waterEntries.userId, userId), inArray(waterEntries.id, ids)))
		},
		(s, l) =>
			s.localDate === l.localDate && s.ml === l.ml && deleted(s.deletedAt) === deleted(l.deletedAt)
	);
	await decide(
		'activity',
		data.activity,
		{
			load: (ids) =>
				tx
					.select()
					.from(activityEntries)
					.where(and(eq(activityEntries.userId, userId), inArray(activityEntries.id, ids)))
		},
		(s, l) =>
			s.localDate === l.localDate &&
			s.kcal === l.kcal &&
			s.note === l.note &&
			deleted(s.deletedAt) === deleted(l.deletedAt)
	);

	// Saved meals match on their name and items' content (item IDs are not portable).
	const mealContent = (
		name: string,
		items: { kind: string; amount: number | null; description: string | null; nutrients: unknown }[]
	) => canonical([name, items.map((i) => [i.kind, i.amount, i.description, i.nutrients])]);
	await decide(
		'saved_meal',
		data.savedMeals,
		{
			load: async (ids) => {
				const rows = await tx
					.select()
					.from(savedMeals)
					.where(and(eq(savedMeals.userId, userId), inArray(savedMeals.id, ids)));
				const items = rows.length
					? await tx
							.select()
							.from(savedMealItems)
							.where(
								inArray(
									savedMealItems.savedMealId,
									rows.map((r) => r.id)
								)
							)
							.orderBy(savedMealItems.position)
					: [];
				return rows.map((r) => ({ ...r, items: items.filter((i) => i.savedMealId === r.id) }));
			}
		},
		(s, l) => mealContent(s.name, s.items) === mealContent(l.name, l.items)
	);

	// Targets are append-only: an imported version matches or is new. New ones are added only when the account
	// has no targets of its own yet.
	await decide(
		'target',
		data.targets,
		{
			load: (ids) =>
				tx
					.select()
					.from(goalVersions)
					.where(and(eq(goalVersions.userId, userId), inArray(goalVersions.id, ids)))
		},
		() => true
	);
	const newTargets = data.targets.filter(
		(t) => decisions.get(key('target', t.id))!.status === 'new'
	);
	const matched = data.targets.length - newTargets.length;
	const [{ existing }] = await tx
		.select({ existing: sql<number>`count(*)::int` })
		.from(goalVersions)
		.where(eq(goalVersions.userId, userId));
	const importTargets = newTargets.length > 0 && existing === matched;
	if (newTargets.length && !importTargets) {
		counts.target.new -= newTargets.length;
		counts.target.skipped += newTargets.length;
		warnings.add('targets_kept');
	}

	const [currentProfile] = await tx.select().from(profiles).where(eq(profiles.userId, userId));
	const incoming = data.account.profile;
	let importProfile = false;
	if (incoming) {
		if (!currentProfile) {
			importProfile = true;
			counts.profile.new = 1;
		} else {
			const fields = Object.keys(incoming) as (keyof typeof incoming)[];
			if (fields.every((f) => currentProfile[f] === incoming[f])) counts.profile.unchanged = 1;
			else {
				counts.profile.skipped = 1;
				warnings.add('profile_kept');
			}
		}
	}

	const completed = new Set(
		(
			await tx
				.select({ d: dayCompletions.localDate })
				.from(dayCompletions)
				.where(eq(dayCompletions.userId, userId))
		).map((r) => r.d)
	);
	const newCompletions = data.dayCompletions.filter((d) => !completed.has(d.localDate));
	counts.dayCompletion.new = newCompletions.length;
	counts.dayCompletion.unchanged = data.dayCompletions.length - newCompletions.length;

	const dates = [...data.diary, ...data.weight, ...data.water, ...data.activity]
		.map((r) => r.localDate)
		.sort();

	return {
		summary: {
			sourceInstallation: file.sourceInstallation,
			sameInstallation: same,
			exportedAt: file.exportedAt,
			alreadyImported: !!repeat,
			dateRange: dates.length ? { from: dates[0], to: dates.at(-1)! } : null,
			counts,
			warnings: [...warnings]
		},
		decisions,
		foodMap,
		importTargets,
		importProfile,
		newCompletions
	};
}

async function write(tx: Tx, userId: string, data: PortableData, p: Plan, source: string) {
	const now = new Date();
	const isNew = (kind: IdKind, id: string) => p.decisions.get(key(kind, id))!.status === 'new';
	const localId = (kind: IdKind, id: string) => p.decisions.get(key(kind, id))!.localId;
	const identities: (typeof importIdentities.$inferInsert)[] = [];
	const remember = (kind: IdKind, sourceId: string) =>
		identities.push({
			userId,
			sourceInstall: source,
			kind,
			sourceId,
			localId: localId(kind, sourceId)
		});
	const chunked = async <T>(rows: T[], insert: (chunk: T[]) => Promise<unknown>) => {
		for (let i = 0; i < rows.length; i += 500) await insert(rows.slice(i, i + 500));
	};

	// Foods first (diary entries link to them), as private copies, each after the food it was derived from.
	const remaining = new Set(data.foods.filter((f) => isNew('food', f.id)));
	const newFoods: PortableData['foods'] = [];
	while (remaining.size) {
		const before = remaining.size;
		for (const f of remaining) {
			const source = f.derivedFrom && data.foods.find((x) => x.id === f.derivedFrom);
			if (!source || !remaining.has(source)) {
				newFoods.push(f);
				remaining.delete(f);
			}
		}
		// A cycle cannot come from a valid export; break it rather than loop.
		if (remaining.size === before)
			remaining.forEach((f) => (newFoods.push(f), remaining.delete(f)));
	}
	const cyclic = new Set<string>();
	const placed = new Set<string>();
	for (const f of newFoods) {
		if (
			f.derivedFrom &&
			p.foodMap.has(f.derivedFrom) &&
			isNew('food', f.derivedFrom) &&
			!placed.has(f.derivedFrom)
		)
			cyclic.add(f.id);
		placed.add(f.id);
	}
	await chunked(newFoods, (chunk) =>
		tx.insert(foods).values(
			chunk.map((f) => ({
				id: localId('food', f.id),
				ownerId: userId,
				visibility: 'private' as const,
				name: f.name,
				brand: f.brand,
				searchKey: foodSearchKey(f.name, f.brand),
				basis: f.basis,
				servingLabel: f.servingLabel,
				servingAmount: f.servingAmount,
				servingUnit: f.servingUnit,
				barcode: f.barcode,
				origin: f.origin,
				sourceMeta: { ...(f.sourceMeta ?? {}), importedFrom: source },
				derivedFrom:
					f.derivedFrom && !cyclic.has(f.id) ? (p.foodMap.get(f.derivedFrom) ?? null) : null,
				createdAt: new Date(f.createdAt),
				updatedAt: new Date(f.updatedAt)
			}))
		)
	);
	await chunked(
		newFoods.flatMap((f) => f.nutrients.map((n) => ({ foodId: localId('food', f.id), ...n }))),
		(chunk) => tx.insert(foodNutrients).values(chunk)
	);
	await chunked(
		newFoods.flatMap((f) =>
			f.servings.map((s) => ({ ...s, id: randomUUID(), foodId: localId('food', f.id) }))
		),
		(chunk) => tx.insert(foodServings).values(chunk)
	);
	for (const f of newFoods) {
		// New foods are created live (as the insert policy requires), then archived with their date.
		if (f.archivedAt) {
			await tx
				.update(foods)
				.set({ archivedAt: new Date(f.archivedAt) })
				.where(eq(foods.id, localId('food', f.id)));
		}
		remember('food', f.id);
	}

	const trashed: { table: 'diary' | 'weight' | 'water' | 'activity'; id: string; at: string }[] =
		[];
	const newDiary = data.diary.filter((e) => isNew('diary', e.id));
	await chunked(newDiary, (chunk) =>
		tx.insert(diaryEntries).values(
			chunk.map((e) => ({
				id: localId('diary', e.id),
				userId,
				localDate: e.localDate,
				meal: e.meal,
				zone: e.zone,
				eatenAt: e.eatenAt ? new Date(e.eatenAt) : null,
				kind: e.kind,
				foodId: e.foodId ? (p.foodMap.get(e.foodId) ?? null) : null,
				food: e.food,
				amount: e.amount,
				unit: e.unit,
				description: e.description,
				nutrients: e.nutrients,
				createdAt: new Date(e.createdAt),
				updatedAt: new Date(e.updatedAt)
			}))
		)
	);
	newDiary.forEach((e) => {
		remember('diary', e.id);
		if (e.deletedAt) trashed.push({ table: 'diary', id: localId('diary', e.id), at: e.deletedAt });
	});

	const readingBase = (
		kind: 'weight' | 'water' | 'activity',
		r:
			| PortableData['weight'][number]
			| PortableData['water'][number]
			| PortableData['activity'][number]
	) => ({
		id: localId(kind, r.id),
		userId,
		localDate: r.localDate,
		zone: r.zone,
		source: r.source,
		createdAt: new Date(r.createdAt),
		updatedAt: new Date(r.updatedAt)
	});
	const newWeight = data.weight.filter((r) => isNew('weight', r.id));
	await chunked(newWeight, (chunk) =>
		tx.insert(weightEntries).values(
			chunk.map((r) => ({
				...readingBase('weight', r),
				measuredAt: r.measuredAt ? new Date(r.measuredAt) : null,
				kg: r.kg
			}))
		)
	);
	const newWater = data.water.filter((r) => isNew('water', r.id));
	await chunked(newWater, (chunk) =>
		tx.insert(waterEntries).values(chunk.map((r) => ({ ...readingBase('water', r), ml: r.ml })))
	);
	const newActivity = data.activity.filter((r) => isNew('activity', r.id));
	await chunked(newActivity, (chunk) =>
		tx.insert(activityEntries).values(
			chunk.map((r) => ({
				...readingBase('activity', r),
				kcal: r.kcal,
				note: r.note,
				countsTowardBudget: r.countsTowardBudget,
				kind: r.kind
			}))
		)
	);
	for (const [kind, rows] of [
		['weight', newWeight],
		['water', newWater],
		['activity', newActivity]
	] as const) {
		for (const r of rows) {
			remember(kind, r.id);
			if (r.deletedAt) trashed.push({ table: kind, id: localId(kind, r.id), at: r.deletedAt });
		}
	}
	// New rows are created live (as the insert policies require), then moved to the trash with their dates.
	const trashTables = {
		diary: diaryEntries,
		weight: weightEntries,
		water: waterEntries,
		activity: activityEntries
	};
	for (const t of trashed) {
		const table = trashTables[t.table];
		await tx
			.update(table)
			.set({ deletedAt: new Date(t.at) })
			.where(eq(table.id, t.id));
	}

	const newMeals = data.savedMeals.filter((sm) => isNew('saved_meal', sm.id));
	await chunked(newMeals, (chunk) =>
		tx.insert(savedMeals).values(
			chunk.map((sm) => ({
				id: localId('saved_meal', sm.id),
				userId,
				name: sm.name,
				createdAt: new Date(sm.createdAt),
				updatedAt: new Date(sm.updatedAt)
			}))
		)
	);
	await chunked(
		newMeals.flatMap((sm) =>
			sm.items.map((i, position) => ({
				id: randomUUID(),
				savedMealId: localId('saved_meal', sm.id),
				userId,
				position,
				kind: i.kind,
				foodId: i.foodId ? (p.foodMap.get(i.foodId) ?? null) : null,
				food: i.food,
				amount: i.amount,
				unit: i.unit,
				description: i.description,
				nutrients: i.nutrients
			}))
		),
		(chunk) => tx.insert(savedMealItems).values(chunk)
	);
	newMeals.forEach((sm) => remember('saved_meal', sm.id));

	if (p.importTargets) {
		const newTargets = data.targets.filter((t) => isNew('target', t.id));
		await chunked(newTargets, (chunk) =>
			tx.insert(goalVersions).values(
				chunk.map((t) => ({
					...t,
					id: localId('target', t.id),
					userId,
					createdAt: new Date(t.createdAt)
				}))
			)
		);
		newTargets.forEach((t) => remember('target', t.id));
	}
	if (p.importProfile && data.account.profile) {
		await tx.insert(profiles).values({ userId, ...data.account.profile, updatedAt: now });
	}
	await chunked(p.newCompletions, (chunk) =>
		tx.insert(dayCompletions).values(
			chunk.map((d) => ({
				userId,
				localDate: d.localDate,
				source: d.source,
				completedAt: new Date(d.completedAt)
			}))
		)
	);
	await chunked(identities, (chunk) =>
		tx.insert(importIdentities).values(chunk).onConflictDoNothing()
	);
}

// Service ---------------------------------------------------------------------------------------------------------

export function createPortability(db: Database) {
	return {
		/** The person's export archive (run only after a recent passkey check). */
		async exportArchive(userId: string, now = new Date()): Promise<Uint8Array> {
			return withUser(db, userId, async (tx) => {
				const data = await collect(tx, userId);
				return writeArchive(data, {
					exportedAt: now.toISOString(),
					sourceInstallation: await installationId(tx)
				});
			});
		},

		/** Validates an archive and reports what an import would do, without writing anything. */
		async previewImport(userId: string, bytes: Uint8Array): Promise<ImportSummary> {
			const { manifest, data } = readArchive(bytes);
			return withUser(db, userId, async (tx) => {
				const p = await plan(
					tx,
					userId,
					{
						sha: sha256(bytes),
						sourceInstallation: manifest.sourceInstallation,
						exportedAt: manifest.exportedAt
					},
					data
				);
				return p.summary;
			});
		},

		/**
		 * Imports an archive in one transaction, planning again inside it so an old preview never applies blindly.
		 * The same file cannot be imported twice.
		 */
		async applyImport(userId: string, bytes: Uint8Array): Promise<ImportSummary> {
			const { manifest, data } = readArchive(bytes);
			const sha = sha256(bytes);
			return withUser(db, userId, async (tx) => {
				const p = await plan(
					tx,
					userId,
					{ sha, sourceInstallation: manifest.sourceInstallation, exportedAt: manifest.exportedAt },
					data
				);
				if (p.summary.alreadyImported) throw new PortabilityError('already_imported');
				await write(tx, userId, data, p, manifest.sourceInstallation);
				// The primary key also stops two concurrent imports of the same file.
				await tx.insert(importFiles).values({ userId, sha256: sha, summary: p.summary });
				return p.summary;
			});
		},

		/** Reads a LoseIt export and reports what importing it would do, without writing anything. */
		async previewLoseIt(
			userId: string,
			bytes: Uint8Array,
			options: LoseItOptions
		): Promise<LoseItSummary> {
			const data = readLoseItArchive(bytes);
			return withUser(db, userId, async (tx) => {
				const p = await planLoseIt(tx, userId, data, { sha: sha256(bytes) }, options);
				return p.summary;
			});
		},

		/** Imports a LoseIt export in one transaction, planning again inside it. The same file cannot be imported twice. */
		async applyLoseIt(
			userId: string,
			bytes: Uint8Array,
			options: LoseItOptions
		): Promise<LoseItSummary> {
			const data = readLoseItArchive(bytes);
			const sha = sha256(bytes);
			return withUser(db, userId, async (tx) => {
				const p = await planLoseIt(tx, userId, data, { sha }, options);
				if (p.summary.alreadyImported) throw new PortabilityError('already_imported');
				await writeLoseIt(tx, userId, data, p, options);
				await tx.insert(importFiles).values({ userId, sha256: sha, summary: p.summary });
				return p.summary;
			});
		},

		/**
		 * Deletes an account in one transaction: by the person themselves, or by an admin for someone else (both
		 * after a recent passkey check). Shared foods stay for the household without an owner unless removed too.
		 */
		async deleteAccount(
			actorId: string,
			accountId: string,
			removeSharedFoods: boolean
		): Promise<void> {
			try {
				await withUser(db, actorId, (tx) =>
					tx.execute(sql`select app_delete_account(${accountId}::uuid, ${removeSharedFoods})`)
				);
			} catch (e) {
				const code =
					(e as { cause?: { code?: string }; code?: string }).cause?.code ??
					(e as { code?: string }).code;
				if (code === 'OB001') throw new PortabilityError('last_admin');
				if (code === 'OB002') throw new PortabilityError('not_found');
				if (code === '42501') throw new PortabilityError('forbidden');
				throw e;
			}
		},

		/** The household's accounts, for an admin (RLS shows others only to admins). */
		async members(userId: string) {
			const rows = await withUser(db, userId, (tx) =>
				tx
					.select({
						id: users.id,
						displayName: users.displayName,
						role: users.role,
						createdAt: users.createdAt
					})
					.from(users)
					.orderBy(users.createdAt)
			);
			return rows.map((r) => ({ ...r, createdAt: r.createdAt.toISOString() }));
		},

		/** Deleted accounts, newest first: opaque ID and date only (admins; RLS returns nothing to others). */
		async deletions(userId: string) {
			const rows = await withUser(db, userId, (tx) =>
				tx
					.select()
					.from(accountDeletions)
					.orderBy(sql`${accountDeletions.deletedAt} desc`)
			);
			return rows.map((r) => ({
				accountId: r.accountId,
				deletedAt: r.deletedAt.toISOString(),
				by: r.by,
				removedSharedFoods: r.removedSharedFoods
			}));
		}
	};
}

export type Portability = ReturnType<typeof createPortability>;
