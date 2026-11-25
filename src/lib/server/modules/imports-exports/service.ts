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
import { DEFAULT_APP_ICON, isAppIcon } from '../../../shared/app-icons.ts';
import { DEFAULT_PALETTE, isPalette } from '../../../shared/themes.ts';
import { randomUUID } from 'node:crypto';
import { and, eq, inArray, sql } from 'drizzle-orm';
import { SNAPSHOT, withUser, type Database, type Tx } from '../../db/identity.ts';
import { foodSearchKey } from '../../../shared/search-text.ts';
import { users } from '../auth/index.ts';
import { activityEntries, waterEntries, weightEntries } from '../body/index.ts';
import {
	foodNutrients,
	foods,
	foodServings,
	recipeIngredients,
	recipes
} from '../catalog/index.ts';
import {
	dayCompletions,
	dayNotes,
	diaryEntries,
	purgedRecords,
	savedMealItems,
	savedMeals
} from '../diary/index.ts';
import { goalVersions, hasProfileDetails, profiles } from '../goals/index.ts';
import { reminderSettings } from '../reminders/index.ts';
import { modelChoices } from '../remote-models/index.ts';
import { sha256, type PortableData } from './archive.ts';
import { archiveThread } from './archive-thread.ts';
import {
	LOSEIT_SOURCE,
	planLoseIt,
	writeLoseIt,
	type LoseItOptions,
	type LoseItSummary
} from './loseit-import.ts';
import { accountDeletions, importFiles, importIdentities, installation } from './schema.ts';

type PortabilityCode =
	'already_imported' | 'last_admin' | 'not_found' | 'forbidden' | 'plan_changed';
export class PortabilityError extends Error {
	readonly code: PortabilityCode;
	/** plan_changed: what the import would do now, to confirm again. */
	readonly summary: unknown;
	// Plain fields (not parameter properties): the worker runs this file with Node's type stripping.
	constructor(code: PortabilityCode, summary?: unknown) {
		super(code);
		this.code = code;
		this.summary = summary;
	}
}

type IdKind = 'food' | 'diary' | 'weight' | 'water' | 'activity' | 'target' | 'saved_meal';
// settings: reminder times and model choices, imported only where the account has none (2026-11-21 audit, A17).
type CountKind = IdKind | 'dayCompletion' | 'dayNote' | 'profile' | 'settings';
export interface Counts {
	new: number;
	unchanged: number;
	changed: number;
	skipped: number;
}
export type ImportWarning =
	| 'already_imported'
	| 'changed_kept'
	| 'targets_kept'
	| 'profile_kept'
	| 'food_links_dropped'
	| 'purged_skipped';

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

/**
 * What a preview showed, for that file and those options: an import applies only when its plan, made again inside
 * the import's transaction, is still what the person confirmed (2026-11-21 audit, A15). Not a secret: it proves the
 * preview came first and that nothing changed since, not who may import.
 */
export function confirmKey(sha: string, options: unknown, summary: unknown): string {
	return sha256(new TextEncoder().encode(canonical({ sha, options, summary })));
}

async function installationId(tx: Tx): Promise<string> {
	const [row] = await tx.select({ id: installation.id }).from(installation);
	return row.id;
}

// Export ----------------------------------------------------------------------------------------------------------

/** A database time ("14:00:00") as the archive's "HH:MM". */
const hhmm = (t: string | null) => (t ? t.slice(0, 5) : null);

async function collect(tx: Tx, userId: string): Promise<PortableData> {
	const [me] = await tx.select().from(users).where(eq(users.id, userId));
	const [profile] = await tx.select().from(profiles).where(eq(profiles.userId, userId));
	const [reminder] = await tx
		.select()
		.from(reminderSettings)
		.where(eq(reminderSettings.userId, userId));
	const [choice] = await tx.select().from(modelChoices).where(eq(modelChoices.userId, userId));
	const diary = await tx.select().from(diaryEntries).where(eq(diaryEntries.userId, userId));
	const meals = await tx.select().from(savedMeals).where(eq(savedMeals.userId, userId));
	const mealItems = await tx
		.select()
		.from(savedMealItems)
		.where(eq(savedMealItems.userId, userId))
		.orderBy(savedMealItems.position);

	const recipeRows = await tx.select().from(recipes).where(eq(recipes.ownerId, userId));
	const ingredientRows = await tx
		.select()
		.from(recipeIngredients)
		.where(eq(recipeIngredients.ownerId, userId))
		.orderBy(recipeIngredients.position);

	// The person's own foods, plus every food their diary, saved meals and recipes refer to and the foods those were derived from, as far
	// as they can see them (RLS): enough to interpret and reuse their data.
	const wanted = new Set<string>();
	const owned = await tx.select({ id: foods.id }).from(foods).where(eq(foods.ownerId, userId));
	owned.forEach((f) => wanted.add(f.id));
	diary.forEach((e) => e.foodId && wanted.add(e.foodId));
	mealItems.forEach((i) => i.foodId && wanted.add(i.foodId));
	ingredientRows.forEach((i) => i.foodId && wanted.add(i.foodId));
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
	// Grouped once by food: matching every food against every row grew with foods × rows.
	const groupBy = <T extends { foodId: string }>(rows: T[]) => {
		const by = new Map<string, T[]>();
		for (const r of rows) {
			const list = by.get(r.foodId);
			if (list) list.push(r);
			else by.set(r.foodId, [r]);
		}
		return by;
	};
	const nutrientsOf = groupBy(nutrients);
	const servingsOf = groupBy(servings);

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
						firstDayOfWeek: profile.firstDayOfWeek,
						appIcon:
							isAppIcon(profile.appIcon) && profile.appIcon !== DEFAULT_APP_ICON
								? profile.appIcon
								: null,
						language: profile.language,
						themeMode: profile.themeMode,
						palette: isPalette(profile.palette) ? profile.palette : DEFAULT_PALETTE,
						timeFormat: profile.timeFormat,
						weightView: profile.weightView,
						weightUnit: profile.weightUnit,
						lengthUnit: profile.lengthUnit,
						waterUnit: profile.waterUnit,
						voiceOffSeen: profile.voiceOffSeen,
						holdHintSeen: profile.holdHintSeen,
						maintainOfferDeclinedKg: profile.maintainOfferDeclinedKg
					}
				: null,
			reminders: reminder
				? {
						zone: reminder.zone,
						times: {
							breakfast: hhmm(reminder.breakfast),
							lunch: hhmm(reminder.lunch),
							dinner: hhmm(reminder.dinner),
							weigh_in: hhmm(reminder.weighIn),
							day_complete: hhmm(reminder.dayComplete)
						},
						quietStart: hhmm(reminder.quietStart)!,
						quietEnd: hhmm(reminder.quietEnd)!
					}
				: null,
			modelChoices: choice
				? {
						speak: choice.speak,
						scan: choice.scan,
						speakAllowedAt: iso(choice.speakAllowedAt),
						scanAllowedAt: iso(choice.scanAllowedAt)
					}
				: null
		},
		foods: foodRows.map((f) => {
			const mine = f.ownerId === userId;
			const own = { nutrients: nutrientsOf.get(f.id) ?? [], servings: servingsOf.get(f.id) ?? [] };
			return {
				id: f.id,
				mine,
				name: f.name,
				brand: f.brand,
				basis: f.basis,
				servingLabel: f.servingLabel,
				servingAmount: f.servingAmount,
				servingUnit: f.servingUnit,
				barcode: f.barcode,
				icon: f.icon,
				origin: f.origin,
				// A built-in food's provenance belongs to the installation it came from.
				sourceMeta: mine ? ((f.sourceMeta as Record<string, unknown> | null) ?? null) : null,
				derivedFrom: f.derivedFrom && exported.has(f.derivedFrom) ? f.derivedFrom : null,
				archivedAt: iso(f.archivedAt),
				deletedAt: iso(f.deletedAt),
				createdAt: f.createdAt.toISOString(),
				updatedAt: f.updatedAt.toISOString(),
				nutrients: own.nutrients.map((n) => ({
					code: n.code as never,
					value: n.value,
					qualifier: n.qualifier
				})),
				servings: own.servings.map((s) => ({
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
		// An emptied note is exported too: the last-typed rule needs it, or importing it would keep the old text.
		dayNotes: (await tx.select().from(dayNotes).where(eq(dayNotes.userId, userId))).map((n) => ({
			localDate: n.localDate,
			text: n.text,
			typedAt: n.typedAt.toISOString()
		})),
		loseitIdentities: (
			await tx
				.select()
				.from(importIdentities)
				.where(
					and(
						eq(importIdentities.userId, userId),
						eq(importIdentities.sourceInstall, LOSEIT_SOURCE)
					)
				)
		).flatMap((i) =>
			i.kind === 'saved_meal' ? [] : [{ kind: i.kind, sourceId: i.sourceId, localId: i.localId }]
		),
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
				macroMode: t.macroMode,
				proteinShare: t.proteinShare,
				carbShare: t.carbShare,
				createdAt: t.createdAt.toISOString()
			})
		),
		savedMeals: meals.map((sm) => ({
			id: sm.id,
			name: sm.name,
			revision: sm.revision,
			deletedAt: iso(sm.deletedAt),
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
		})),
		recipes: recipeRows.map((r) => ({
			foodId: r.foodId,
			servings: r.servings,
			cookedYieldG: r.cookedYieldG,
			ingredients: ingredientRows
				.filter((i) => i.recipeId === r.foodId)
				.map((i) => ({
					foodId: i.foodId,
					food: i.food,
					amount: i.amount,
					unit: i.unit,
					nutrients: i.nutrients as never
				}))
		}))
	};
}

// Import ----------------------------------------------------------------------------------------------------------

type Decision =
	| { status: 'new'; localId: string }
	| { status: 'unchanged' | 'changed'; localId: string }
	/** Deleted here and purged from the trash: never added again (owner, 2026-11-19). */
	| { status: 'purged'; localId: string };

interface Plan {
	summary: ImportSummary;
	decisions: Map<string, Decision>;
	/** Source food ID → local food ID for diary links and variants (existing or to be created). */
	foodMap: Map<string, string>;
	importTargets: boolean;
	importProfile: boolean;
	/** The archive's reminder settings, when this account has none yet (as for the profile). */
	importReminders: boolean;
	/** The archive's Speak and Scan choices, likewise. */
	importModelChoices: boolean;
	newCompletions: PortableData['dayCompletions'];
	newNotes: PortableData['dayNotes'];
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
				'dayNote',
				'profile',
				'settings'
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
		// Where a record would be here (an earlier import's, or the same ID on this installation), deleted and purged.
		const wouldBe = (r: T) => located.get(r.id) ?? (same ? r.id : undefined);
		const candidates = [
			...new Set(
				records.filter((r) => !locals.has(located.get(r.id) ?? '')).flatMap((r) => wouldBe(r) ?? [])
			)
		];
		const purged = new Set<string>();
		for (let i = 0; i < candidates.length; i += 1000) {
			const rows = await tx
				.select({ id: purgedRecords.id })
				.from(purgedRecords)
				.where(inArray(purgedRecords.id, candidates.slice(i, i + 1000)));
			for (const row of rows) purged.add(row.id);
		}
		for (const r of records) {
			const localId = located.get(r.id);
			const local = localId ? locals.get(localId) : undefined;
			const gone = local ? undefined : wouldBe(r);
			if (gone && purged.has(gone)) {
				decisions.set(key(kind, r.id), { status: 'purged', localId: gone });
				counts[kind].skipped += 1;
				warnings.add('purged_skipped');
			} else if (!local) {
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

	// Foods: the person's own become theirs again; a food that isn't theirs (a built-in one, or someone else's in an
	// older archive) maps to the same food when it is visible here, otherwise it becomes a copy of their own.
	const foodMap = new Map<string, string>();
	const ownFoods = data.foods.filter((f) => f.mine);
	const otherFoods = data.foods.filter((f) => !f.mine);
	// What a food says, for "unchanged": its portions and its archived or deleted state too (2026-11-25 audit: a
	// food with new portions was called unchanged). Not its icon, ID or times.
	type Content = {
		name: string;
		brand: string | null;
		basis: string;
		servingLabel: string | null;
		servingAmount: number | null;
		servingUnit: string | null;
		barcode: string | null;
		archivedAt: Date | string | null;
		deletedAt?: Date | string | null;
	};
	type Portion = { name: string; amount: number; unit: string; source: string };
	const foodContent = (f: Content, n: unknown, servings: Portion[]) =>
		canonical([
			f.name,
			f.brand,
			f.basis,
			f.servingLabel,
			f.servingAmount,
			f.servingUnit,
			f.barcode,
			f.archivedAt !== null,
			(f.deletedAt ?? null) !== null,
			n,
			servings
				.map((x) => [x.name, x.amount, x.unit, x.source])
				.sort((a, b) => canonical(a).localeCompare(canonical(b)))
		]);
	const loadFoods = async (ids: string[]) => {
		const rows = await tx.select().from(foods).where(inArray(foods.id, ids));
		const portions = rows.length
			? await tx
					.select()
					.from(foodServings)
					.where(
						inArray(
							foodServings.foodId,
							rows.map((r) => r.id)
						)
					)
			: [];
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
				.sort((a, b) => a.code.localeCompare(b.code)),
			servings: portions.filter((x) => x.foodId === r.id)
		}));
	};
	const sortedNutrients = (f: PortableData['foods'][number]) =>
		[...f.nutrients].sort((a, b) => a.code.localeCompare(b.code));
	await decide(
		'food',
		ownFoods,
		{ load: async (ids) => (await loadFoods(ids)).filter((r) => r.ownerId === userId) },
		(s, l) =>
			foodContent(s, sortedNutrients(s), s.servings) === foodContent(l, l.nutrients, l.servings)
	);
	if (otherFoods.length) {
		const visible = same
			? new Set(
					(
						await tx
							.select({ id: foods.id })
							.from(foods)
							.where(
								inArray(
									foods.id,
									otherFoods.map((f) => f.id)
								)
							)
					).map((r) => r.id)
				)
			: new Set<string>();
		const copies = otherFoods.filter((f) => !visible.has(f.id));
		for (const f of otherFoods.filter((f) => visible.has(f.id))) {
			decisions.set(key('food', f.id), { status: 'unchanged', localId: f.id });
			counts.food.unchanged += 1;
		}
		await decide(
			'food',
			copies,
			{ load: async (ids) => (await loadFoods(ids)).filter((r) => r.ownerId === userId) },
			(s, l) =>
				foodContent(s, sortedNutrients(s), s.servings) === foodContent(l, l.nutrients, l.servings)
		);
	}
	// A purged food has no record to link to: entries using it keep their own snapshot, as for a food that's gone.
	for (const f of data.foods) {
		const d = decisions.get(key('food', f.id))!;
		if (d.status !== 'purged') foodMap.set(f.id, d.localId);
	}
	const inFile = new Set(data.foods.map((f) => f.id));
	if (
		[
			...data.diary,
			...data.savedMeals.flatMap((sm) => sm.items),
			...data.recipes.flatMap((r) => r.ingredients)
		].some((e) => e.foodId && !inFile.has(e.foodId))
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

	// Saved meals match on their name, trash state and items' content: each item's food by its name, and its unit
	// without the serving's ID (item, food and serving IDs are not portable; 2026-11-25 audit: a meal in the trash
	// was called unchanged).
	type MealItem = {
		kind: string;
		amount: number | null;
		description: string | null;
		nutrients: unknown;
		food: { name: string } | null;
		unit: Record<string, unknown> | null;
	};
	const portableUnit = (u: MealItem['unit']) =>
		u && Object.fromEntries(Object.entries(u).filter(([k]) => k !== 'servingId'));
	const mealContent = (name: string, inTrash: boolean, items: MealItem[]) =>
		canonical([
			name,
			inTrash,
			items.map((i) => [
				i.kind,
				i.amount,
				i.description,
				i.nutrients,
				i.food?.name ?? null,
				portableUnit(i.unit)
			])
		]);
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
		(s, l) =>
			mealContent(s.name, (s.deletedAt ?? null) !== null, s.items as MealItem[]) ===
			mealContent(l.name, l.deletedAt !== null, l.items as MealItem[])
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

	const [currentReminders] = await tx
		.select({ userId: reminderSettings.userId })
		.from(reminderSettings)
		.where(eq(reminderSettings.userId, userId));
	const importReminders = !!data.account.reminders && !currentReminders;
	const [currentChoices] = await tx
		.select({ userId: modelChoices.userId })
		.from(modelChoices)
		.where(eq(modelChoices.userId, userId));
	const importModelChoices = !!data.account.modelChoices && !currentChoices;
	counts.settings.new = Number(importReminders) + Number(importModelChoices);
	counts.settings.unchanged =
		Number(!!data.account.reminders && !importReminders) +
		Number(!!data.account.modelChoices && !importModelChoices);
	const [currentProfile] = await tx.select().from(profiles).where(eq(profiles.userId, userId));
	const incoming = data.account.profile;
	let importProfile = false;
	if (incoming) {
		// A profile row with no details only holds settings made for a new account (its first page saves the
		// browser's and the place's choices): an archive's own profile replaces it (2026-11-22 audit, A04).
		if (!hasProfileDetails(currentProfile)) {
			importProfile = true;
			counts.profile.new = 1;
		} else {
			// Fields this version no longer keeps (scanLogAfter) don't count as a difference.
			const fields = (Object.keys(incoming) as (keyof typeof incoming)[]).filter(
				(f): f is Exclude<typeof f, 'scanLogAfter'> => f !== 'scanLogAfter'
			);
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

	// The same rule as everywhere for notes: the version typed last stays.
	const notesHere = new Map(
		(await tx.select().from(dayNotes).where(eq(dayNotes.userId, userId))).map((n) => [
			n.localDate,
			n.typedAt.getTime()
		])
	);
	// An emptied note only clears an older one here; on a day with no note it adds nothing.
	const newNotes = data.dayNotes.filter((n) => {
		const here = notesHere.get(n.localDate);
		if (n.text.trim() === '' && here === undefined) return false;
		return (here ?? -Infinity) < new Date(n.typedAt).getTime();
	});
	counts.dayNote.new = newNotes.length;
	counts.dayNote.unchanged = data.dayNotes.length - newNotes.length;

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
		importReminders,
		importModelChoices,
		newCompletions,
		newNotes
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
	const foodById = new Map(data.foods.map((f) => [f.id, f])); // not a search per food (Gemini audit 2, H21)
	const newFoods: PortableData['foods'] = [];
	while (remaining.size) {
		const before = remaining.size;
		for (const f of remaining) {
			const source = f.derivedFrom && foodById.get(f.derivedFrom);
			if (!source || !remaining.has(source)) {
				newFoods.push(f);
				remaining.delete(f);
			}
		}
		// A cycle cannot come from a valid export; break it rather than loop.
		if (remaining.size === before)
			remaining.forEach((f) => (newFoods.push(f), remaining.delete(f)));
	}
	const builtInIds = new Set(data.foods.filter((f) => f.origin === 'curated').map((f) => f.id));
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
				name: f.name,
				brand: f.brand,
				searchKey: foodSearchKey(f.name, f.brand),
				basis: f.basis,
				servingLabel: f.servingLabel,
				servingAmount: f.servingAmount,
				servingUnit: f.servingUnit,
				barcode: f.barcode,
				icon: f.icon,
				// A built-in food from another installation becomes the person's own copy.
				origin: f.origin === 'curated' ? ('variant' as const) : f.origin,
				sourceMeta: { ...(f.sourceMeta ?? {}), importedFrom: source },
				// A variant keeps its source only when that is a built-in food (variants of other foods are not made).
				derivedFrom:
					f.derivedFrom && !cyclic.has(f.id) && builtInIds.has(f.derivedFrom)
						? (p.foodMap.get(f.derivedFrom) ?? null)
						: null,
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
		// New foods are created live (as the insert policy requires), then archived, or deleted, with their dates.
		if (f.archivedAt) {
			await tx
				.update(foods)
				.set({
					archivedAt: new Date(f.archivedAt),
					deletedAt: f.deletedAt ? new Date(f.deletedAt) : null
				})
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
				deletedAt: sm.deletedAt ? new Date(sm.deletedAt) : null,
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

	// A recipe comes with its food: attached only when this import creates that food, so a retry (the food is
	// already remembered) or a food matched to one already here never gets a second ingredient list.
	const newFoodIds = new Set(newFoods.map((f) => f.id));
	const newRecipes = data.recipes.filter((r) => newFoodIds.has(r.foodId));
	await chunked(newRecipes, (chunk) =>
		tx.insert(recipes).values(
			chunk.map((r) => ({
				foodId: localId('food', r.foodId),
				ownerId: userId,
				servings: r.servings,
				cookedYieldG: r.cookedYieldG
			}))
		)
	);
	await chunked(
		newRecipes.flatMap((r) =>
			r.ingredients.map((i, position) => ({
				id: randomUUID(),
				recipeId: localId('food', r.foodId),
				ownerId: userId,
				position,
				foodId: i.foodId ? (p.foodMap.get(i.foodId) ?? null) : null,
				food: i.food,
				amount: i.amount,
				unit: i.unit,
				nutrients: i.nutrients
			}))
		),
		(chunk) => tx.insert(recipeIngredients).values(chunk)
	);

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
		// "Log it after saving" (scanLogAfter) is in older archives; Scan no longer has it (owner, 2026-11-09).
		// eslint-disable-next-line @typescript-eslint/no-unused-vars
		const { scanLogAfter, ...profile } = data.account.profile;
		// Settings that came with the archive count as saved, so a browser's own choices don't replace them. A row
		// holding only a new account's settings is replaced (A04).
		const values = {
			...profile,
			preferencesSavedAt: profile.themeMode !== undefined ? now : null,
			updatedAt: now
		};
		await tx
			.insert(profiles)
			.values({ userId, ...values })
			.onConflictDoUpdate({ target: profiles.userId, set: values });
	}
	const mc = data.account.modelChoices;
	if (p.importModelChoices && mc) {
		await tx.insert(modelChoices).values({
			userId,
			speak: mc.speak,
			scan: mc.scan,
			speakAllowedAt: mc.speakAllowedAt ? new Date(mc.speakAllowedAt) : null,
			scanAllowedAt: mc.scanAllowedAt ? new Date(mc.scanAllowedAt) : null,
			updatedAt: now
		});
	}
	const r = data.account.reminders;
	if (p.importReminders && r) {
		await tx.insert(reminderSettings).values({
			userId,
			zone: r.zone,
			breakfast: r.times.breakfast,
			lunch: r.times.lunch,
			dinner: r.times.dinner,
			weighIn: r.times.weigh_in,
			dayComplete: r.times.day_complete,
			quietStart: r.quietStart,
			quietEnd: r.quietEnd,
			updatedAt: now
		});
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
	await chunked(p.newNotes, (chunk) =>
		tx
			.insert(dayNotes)
			.values(
				chunk.map((n) => ({
					userId,
					localDate: n.localDate,
					text: n.text,
					typedAt: new Date(n.typedAt)
				}))
			)
			.onConflictDoUpdate({
				target: [dayNotes.userId, dayNotes.localDate],
				set: { text: sql`excluded.text`, typedAt: sql`excluded.typed_at` },
				// A note saved here while the import ran, typed after the archive's, stays.
				setWhere: sql`${dayNotes.typedAt} < excluded.typed_at`
			})
	);
	// What the archive's LoseIt rows became, pointed at the records they are here now. Rows whose record is not in the
	// archive (purged from the trash) have nothing to point at and are left out.
	for (const i of data.loseitIdentities) {
		// Targets are left out when the account keeps its own: nothing is there to point at (2026-11-25 Review.md
		// audit, 2.9).
		if (i.kind === 'target' && !p.importTargets) continue;
		const here = p.decisions.get(key(i.kind, i.localId));
		if (here && here.status !== 'purged')
			identities.push({
				userId,
				sourceInstall: LOSEIT_SOURCE,
				kind: i.kind,
				sourceId: i.sourceId,
				localId: here.localId
			});
	}
	await chunked(identities, (chunk) =>
		tx.insert(importIdentities).values(chunk).onConflictDoNothing()
	);
}

// Service ---------------------------------------------------------------------------------------------------------

/**
 * One import at a time per account, held until its transaction ends. Two overlapping files imported at once would each
 * plan a record as new before either is committed, and both would add it; the second now plans after the first.
 */
async function lockImports(tx: Tx, userId: string): Promise<void> {
	await tx.execute(sql`select pg_advisory_xact_lock(hashtext('obur:import'), hashtext(${userId}))`);
}

export function createPortability(db: Database) {
	return {
		/** The person's export archive (run only after a recent passkey check). */
		async exportArchive(userId: string, now = new Date()): Promise<Uint8Array> {
			// One snapshot: an edit committed during the export must not leave a recipe's ingredients from before it
			// beside its values from after (2026-11-20 audit). Compressed once the connection is free again.
			const { data, sourceInstallation } = await withUser(
				db,
				userId,
				async (tx) => ({
					data: await collect(tx, userId),
					sourceInstallation: await installationId(tx)
				}),
				SNAPSHOT
			);
			return archiveThread.write(data, { exportedAt: now.toISOString(), sourceInstallation });
		},

		/**
		 * Validates an archive and reports what an import would do, without writing anything. Its `confirm` goes
		 * back with the import.
		 */
		async previewImport(
			userId: string,
			bytes: Uint8Array
		): Promise<ImportSummary & { confirm: string }> {
			const { manifest, data } = await archiveThread.read(bytes);
			const sha = sha256(bytes);
			return withUser(db, userId, async (tx) => {
				const p = await plan(
					tx,
					userId,
					{ sha, sourceInstallation: manifest.sourceInstallation, exportedAt: manifest.exportedAt },
					data
				);
				return { ...p.summary, confirm: confirmKey(sha, null, p.summary) };
			});
		},

		/**
		 * Imports an archive in one transaction, planning again inside it so an old preview never applies blindly:
		 * a plan that differs from the confirmed preview is refused with the new one. The same file cannot be
		 * imported twice.
		 */
		async applyImport(userId: string, bytes: Uint8Array, confirm: string): Promise<ImportSummary> {
			const { manifest, data } = await archiveThread.read(bytes);
			const sha = sha256(bytes);
			return withUser(db, userId, async (tx) => {
				await lockImports(tx, userId);
				const p = await plan(
					tx,
					userId,
					{ sha, sourceInstallation: manifest.sourceInstallation, exportedAt: manifest.exportedAt },
					data
				);
				if (p.summary.alreadyImported) throw new PortabilityError('already_imported');
				if (confirmKey(sha, null, p.summary) !== confirm)
					throw new PortabilityError('plan_changed', {
						...p.summary,
						confirm: confirmKey(sha, null, p.summary)
					});
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
		): Promise<LoseItSummary & { confirm: string }> {
			const data = await archiveThread.loseit(bytes);
			const sha = sha256(bytes);
			return withUser(db, userId, async (tx) => {
				const p = await planLoseIt(tx, userId, data, { sha }, options);
				return { ...p.summary, confirm: confirmKey(sha, options, p.summary) };
			});
		},

		/**
		 * Imports a LoseIt export in one transaction, planning again inside it; a plan that differs from the
		 * confirmed preview is refused with the new one. The same file cannot be imported twice.
		 */
		async applyLoseIt(
			userId: string,
			bytes: Uint8Array,
			options: LoseItOptions,
			confirm: string
		): Promise<LoseItSummary> {
			const data = await archiveThread.loseit(bytes);
			const sha = sha256(bytes);
			return withUser(db, userId, async (tx) => {
				await lockImports(tx, userId);
				const p = await planLoseIt(tx, userId, data, { sha }, options);
				if (p.summary.alreadyImported) throw new PortabilityError('already_imported');
				const now = confirmKey(sha, options, p.summary);
				if (now !== confirm)
					throw new PortabilityError('plan_changed', { ...p.summary, confirm: now });
				await writeLoseIt(tx, userId, data, p, options);
				await tx.insert(importFiles).values({ userId, sha256: sha, summary: p.summary });
				return p.summary;
			});
		},

		/**
		 * Deletes an account in one transaction: by the person themselves, or by an admin for someone else (both
		 * after a recent passkey check). Their foods go with them.
		 */
		async deleteAccount(actorId: string, accountId: string): Promise<void> {
			try {
				await withUser(db, actorId, (tx) =>
					tx.execute(sql`select app_delete_account(${accountId}::uuid)`)
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

		/**
		 * Every account, for an admin (RLS shows others only to admins).
		 */
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
				by: r.by
			}));
		}
	};
}

export type Portability = ReturnType<typeof createPortability>;
