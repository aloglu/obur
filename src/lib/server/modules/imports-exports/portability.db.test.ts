// Export, import and account deletion against real PostgreSQL, run as the runtime role.
import { randomUUID } from 'node:crypto';
import { drizzle } from 'drizzle-orm/postgres-js';
import { strFromU8, strToU8, unzipSync, zipSync } from 'fflate';
import postgres from 'postgres';
import * as v from 'valibot';
import { afterAll, beforeEach, describe, expect, inject, it } from 'vitest';
import { FoodInput } from '../../../shared/food-input.ts';
import { foodSearchKey } from '../../../shared/search-text.ts';
import { createBody } from '../body/index.ts';
import { createCatalog, createRecipes } from '../catalog/index.ts';
import { createDiary, createSavedMeals } from '../diary/index.ts';
import { createGoals } from '../goals/index.ts';
import { createReminders } from '../reminders/index.ts';
import { createRemoteModels } from '../remote-models/index.ts';
import {
	ArchiveError,
	fitsImport,
	LIMITS,
	readArchive,
	sha256,
	type PortableData
} from './archive.ts';
import { createPortability, PortabilityError } from './service.ts';

const urls = inject('db');
const quiet = { onnotice: () => {} };
const admin = postgres(urls.admin, { max: 1, ...quiet });
const appSql = postgres(urls.app, { max: 2, ...quiet });
const workerSql = postgres(urls.worker, { max: 1, ...quiet });
const db = drizzle(appSql);
const catalog = createCatalog(db);
const diary = createDiary(db);
const body = createBody(db);
const goals = createGoals(db);
const savedMeals = createSavedMeals(db);
const recipes = createRecipes(db);
const portability = createPortability(db);
// An import as the page makes it: the preview first, then the import with what it showed.
const applyImport = async (userId: string, bytes: Uint8Array) =>
	portability.applyImport(userId, bytes, (await portability.previewImport(userId, bytes)).confirm);
const reminders = createReminders(db);
const remoteModels = createRemoteModels(db, Buffer.alloc(32, 7));
const MEHMET_KEY = 'sk-portability-test-key-0123456789';

const AYSE = randomUUID(); // admin
const MEHMET = randomUUID();
const ZEYNEP = randomUUID();
const ist = { zone: 'Europe/Istanbul' };
const grams = { kind: 'mass', unit: 'g' } as const;

const food = (input: Record<string, unknown>) => v.parse(FoodInput, input);

/** A built-in (curated) food, as `obur migrate` loads them: no owner, readable by everyone, edited by no one. */
async function builtIn(input: {
	name: string;
	brand?: string;
	basis: '100g' | '100ml';
	kcal: number;
	carbs?: number;
	portions?: { name: string; amount: number; unit: 'g' | 'ml' }[];
}): Promise<string> {
	const [{ id }] =
		await admin`insert into foods (name, brand, search_key, basis, origin, source_meta)
		values (${input.name}, ${input.brand ?? null}, ${foodSearchKey(input.name, input.brand ?? null)},
			${input.basis}, 'curated', ${admin.json({ dataset: 'sr_legacy', fdcId: randomUUID() })})
		returning id`;
	await admin`insert into food_nutrients (food_id, code, value, qualifier)
		values (${id}, 'energy_kcal', ${input.kcal}, 'reported')`;
	if (input.carbs !== undefined)
		await admin`insert into food_nutrients (food_id, code, value, qualifier)
			values (${id}, 'carbohydrate_excl_fibre', ${input.carbs}, 'reported')`;
	for (const p of input.portions ?? [])
		await admin`insert into food_servings (food_id, name, amount, unit, source)
			values (${id}, ${p.name}, ${p.amount}, ${p.unit}, 'reference')`;
	return id;
}

beforeEach(async () => {
	await admin`truncate users, account_deletions cascade`;
	await admin`insert into users (id, display_name, role) values
		(${AYSE}, 'Ayşe', 'admin'), (${MEHMET}, 'Mehmet', 'member'), (${ZEYNEP}, 'Zeynep', 'member')`;
});

afterAll(async () => {
	await Promise.all([admin.end(), appSql.end(), workerSql.end()]);
});

/**
 * A complex history for Mehmet: a built-in food, his own serving-only food with an unknown nutrient and a "less
 * than" value, an archived food, a variant, two identical quick adds, trash, weight, water, counted and uncounted
 * activity, targets, a profile, a completed day, and a saved meal whose built-in food (Ayran) no diary entry refers
 * to any more, as after its entry was purged from the trash.
 */
async function buildHistory() {
	// Reminder settings travel with the account; this device's push subscription never does.
	await reminders.saveSettings(MEHMET, {
		zone: 'Europe/Istanbul',
		times: { breakfast: null, lunch: '14:00', dinner: null, weigh_in: '08:30', day_complete: null },
		quietStart: '23:00',
		quietEnd: '07:00'
	});
	await reminders.subscribe(MEHMET, {
		endpoint: 'https://push.example/mehmet-phone',
		keys: { p256dh: 'secret-key', auth: 'secret-auth' }
	});
	// His choice for Speak travels with the account; his own key never does.
	await remoteModels.saveKey(MEHMET, 'openai', MEHMET_KEY);
	await remoteModels.choose(MEHMET, 'speak', 'openai', true);
	await remoteModels.countUse(MEHMET, 'openai', 'speak');
	const ekmek = await builtIn({
		name: 'Premium Light Ekmek',
		brand: 'Untad',
		basis: '100g',
		kcal: 193,
		carbs: 42.4,
		portions: [{ name: 'dilim', amount: 26, unit: 'g' }]
	});
	const borek = await catalog.createFood(
		MEHMET,
		food({
			name: 'Annemin böreği',
			icon: '1F967',
			basis: 'serving',
			servingLabel: '1 dilim',
			nutrients: [
				{ code: 'energy_kcal', value: 310, qualifier: 'estimate' },
				{ code: 'sugars', value: 0.5, qualifier: 'less_than' }
			],
			servings: []
		})
	);
	const old = await catalog.createFood(
		MEHMET,
		food({
			name: 'Eski yoğurt',
			basis: '100g',
			nutrients: [{ code: 'energy_kcal', value: 60, qualifier: 'reported' }],
			servings: []
		})
	);
	await catalog.setArchived(MEHMET, old, true);
	const variant = await catalog.makeVariant(MEHMET, ekmek);

	const day = (localDate: string, meal: 'breakfast' | 'snacks' = 'breakfast') => ({
		localDate,
		meal,
		...ist
	});
	await diary.logFood(MEHMET, day('2026-10-01'), await catalog.getFood(MEHMET, ekmek), 52, grams);
	await diary.logFood(
		MEHMET,
		day('2026-10-01', 'snacks'),
		await catalog.getFood(MEHMET, borek),
		1,
		{ kind: 'basis_serving' }
	);
	await diary.logFood(MEHMET, day('2026-10-02'), await catalog.getFood(MEHMET, variant), 26, grams);
	await diary.quickAdd(MEHMET, day('2026-10-02', 'snacks'), 120, 'Çay ve simit');
	await diary.quickAdd(MEHMET, day('2026-10-02', 'snacks'), 120, 'Çay ve simit');
	const trashed = await diary.quickAdd(MEHMET, day('2026-10-03'), 500, 'Yanlış');
	await diary.remove(MEHMET, trashed.id);

	await body.logWeight(MEHMET, { localDate: '2026-10-01', ...ist }, 104.3);
	const w = await body.logWeight(MEHMET, { localDate: '2026-10-02', ...ist }, 140.3);
	await body.removeWeight(MEHMET, w.id);
	await body.logWater(MEHMET, { localDate: '2026-10-01', ...ist }, 250);
	await body.logActivity(MEHMET, { localDate: '2026-10-02', ...ist }, 300, 'Yürüyüş');
	await admin`insert into activity_entries (id, user_id, local_date, zone, source, kcal, counts_toward_budget)
		values (${randomUUID()}, ${MEHMET}, '2026-10-02', 'Europe/Istanbul', 'loseit', 210, false)`;

	await goals.saveProfile(MEHMET, { heightCm: 180, birthDate: '1990-05-01', sex: 'male' });
	await goals.savePreferences(MEHMET, { palette: 'kaset', appIcon: 'zerde', timeFormat: '24' });
	// A language stored before it can be chosen here (a later version's archive) still travels with the account.
	await admin`update profiles set language = 'tr' where user_id = ${MEHMET}`;
	await goals.setTarget(
		MEHMET,
		{ mode: 'manual', effectiveFrom: '2026-10-01', budgetKcal: 2200 },
		null
	);
	await goals.setTarget(
		MEHMET,
		{
			mode: 'manual',
			effectiveFrom: '2026-10-02',
			budgetKcal: 2100,
			macros: { mode: 'percent', proteinPct: 30, carbPct: 40, fatPct: 30 }
		},
		null
	);
	await diary.setDayComplete(MEHMET, '2026-10-01', true);

	const ayran = await builtIn({ name: 'Ayran', basis: '100ml', kcal: 38 });
	const [bread, tea] = await diary.day(MEHMET, '2026-10-02');
	const drink = await diary.logFood(
		MEHMET,
		day('2026-10-02'),
		await catalog.getFood(MEHMET, ayran),
		200,
		{ kind: 'volume', unit: 'ml' }
	);
	await savedMeals.createFromEntries(MEHMET, {
		name: 'Kahvaltı',
		entryIds: [bread.id, tea.id, drink.id]
	});
	await admin`delete from diary_entries where id = ${drink.id}`;
	// A recipe from the built-in bread and ayran, weighed after cooking.
	await recipes.save(MEHMET, {
		id: randomUUID(),
		version: null,
		name: 'Ayranlı tost',
		icon: '1F96A',
		servings: 2,
		cookedYieldG: 240,
		ingredients: [
			{
				food: await catalog.getFood(MEHMET, ekmek),
				amount: 100,
				unit: { kind: 'mass', unit: 'g' }
			},
			{
				food: await catalog.getFood(MEHMET, ayran),
				amount: 200,
				unit: { kind: 'volume', unit: 'ml' }
			}
		]
	});
	return { ekmek, borek, old, variant, ayran };
}

/** The meaning of an export without IDs, ownership, revisions or update times. */
function semantic(data: PortableData) {
	const foodName = new Map(data.foods.map((f) => [f.id, f.name]));
	const byText = <T>(rows: T[]) => rows.map((r) => JSON.stringify(r)).sort();
	return {
		profile: data.account.profile,
		reminders: data.account.reminders,
		modelChoices: data.account.modelChoices,
		foods: byText(
			data.foods.map((f) => ({
				name: f.name,
				brand: f.brand,
				basis: f.basis,
				servingLabel: f.servingLabel,
				icon: f.icon,
				archived: !!f.archivedAt,
				derivedFrom: f.derivedFrom ? foodName.get(f.derivedFrom) : null,
				nutrients: [...f.nutrients].sort((a, b) => a.code.localeCompare(b.code)),
				servings: f.servings.map(({ name, amount, unit, source }) => ({
					name,
					amount,
					unit,
					source
				})),
				createdAt: f.createdAt
			}))
		),
		diary: byText(
			data.diary.map((e) => ({
				localDate: e.localDate,
				meal: e.meal,
				zone: e.zone,
				kind: e.kind,
				food: e.food,
				linked: e.foodId ? foodName.get(e.foodId) : null,
				amount: e.amount,
				unit: e.unit,
				description: e.description,
				nutrients: e.nutrients,
				createdAt: e.createdAt,
				deletedAt: e.deletedAt
			}))
		),
		weight: byText(
			data.weight.map(({ localDate, kg, deletedAt }) => ({ localDate, kg, deletedAt }))
		),
		water: byText(data.water.map(({ localDate, ml, deletedAt }) => ({ localDate, ml, deletedAt }))),
		activity: byText(
			data.activity.map(({ localDate, kcal, note, source, countsTowardBudget }) => ({
				localDate,
				kcal,
				note,
				source,
				countsTowardBudget
			}))
		),
		targets: byText(data.targets.map((t) => ({ ...t, id: undefined }))),
		savedMeals: byText(
			data.savedMeals.map((sm) => ({
				name: sm.name,
				createdAt: sm.createdAt,
				items: sm.items.map((i) => ({ ...i, foodId: i.foodId ? foodName.get(i.foodId) : null }))
			}))
		),
		recipes: byText(
			data.recipes.map((r) => ({
				name: foodName.get(r.foodId),
				servings: r.servings,
				cookedYieldG: r.cookedYieldG,
				ingredients: r.ingredients.map((i) => ({
					...i,
					foodId: i.foodId ? foodName.get(i.foodId) : null
				}))
			}))
		),
		completions: byText(data.dayCompletions),
		notes: byText(data.dayNotes)
	};
}

/** Rewrites an archive as if it came from another installation (manifest only; checksums still hold). */
function fromElsewhere(bytes: Uint8Array, install: string = randomUUID()): Uint8Array {
	const files = unzipSync(bytes);
	const manifest = JSON.parse(strFromU8(files['manifest.json']));
	files['manifest.json'] = strToU8(JSON.stringify({ ...manifest, sourceInstallation: install }));
	return zipSync(files);
}

const count = async (table: string, userId: string) =>
	Number(
		(await admin.unsafe(`select count(*) from ${table} where user_id = $1`, [userId]))[0].count
	);

describe('export', () => {
	it('reads one moment: an edit committed during the export never mixes into it (2026-11-20 audit)', async () => {
		const flour = await catalog.createFood(
			MEHMET,
			food({
				name: 'Flour',
				basis: '100g',
				nutrients: [{ code: 'energy_kcal', value: 364, qualifier: 'reported' }]
			})
		);
		const recipeId = randomUUID();
		await recipes.save(MEHMET, {
			id: recipeId,
			version: null,
			name: 'Flatbread',
			icon: null,
			servings: 2,
			cookedYieldG: null,
			ingredients: [{ food: await catalog.getFood(MEHMET, flour), amount: 100, unit: grams }]
		});
		const editor = postgres(urls.admin, { max: 1, ...quiet });
		const watcher = postgres(urls.admin, { max: 1, ...quiet });
		try {
			let exporting: Promise<Uint8Array> | undefined;
			// The export reads the recipe, then waits on its ingredients while the edit commits.
			await editor.begin(async (tx) => {
				await tx`lock table recipe_ingredients in access exclusive mode`;
				exporting = portability.exportArchive(MEHMET);
				for (let i = 0; i < 200; i++) {
					const [w] = await watcher`select count(*)::int as n from pg_stat_activity
						where wait_event_type = 'Lock' and query ilike '%recipe_ingredients%'`;
					if (w.n > 0) break;
					await new Promise((r) => setTimeout(r, 10));
				}
				await tx`update recipes set servings = 4 where food_id = ${recipeId}`;
				await tx`update recipe_ingredients set amount = 200 where recipe_id = ${recipeId}`;
			});
			const { data } = readArchive(await exporting!);
			const recipe = data.recipes.find((r) => r.foodId === recipeId)!;
			expect([recipe.servings, recipe.ingredients[0].amount]).toEqual([2, 100]);
		} finally {
			await Promise.all([editor.end(), watcher.end()]);
		}
	});

	it('contains the person’s data, trash and the foods it depends on, and nobody else’s', async () => {
		await buildHistory();
		await diary.quickAdd(ZEYNEP, { localDate: '2026-10-01', meal: 'lunch', ...ist }, 999, 'Zeynep');
		const { manifest, data } = readArchive(await portability.exportArchive(MEHMET));

		expect(manifest.files.find((f) => f.path === 'data/diary.json')?.rows).toBe(6);
		expect(data.diary.map((e) => e.description)).not.toContain('Zeynep');
		expect(data.diary.filter((e) => e.deletedAt)).toHaveLength(1);
		expect(data.weight.filter((w) => w.deletedAt)).toHaveLength(1);
		expect(data.targets.find((t) => t.macroMode === 'percent')).toMatchObject({
			proteinShare: 0.3,
			carbShare: 0.4,
			fatShare: 0.3
		});
		expect(data.activity.map((a) => a.countsTowardBudget).sort()).toEqual([false, true]);
		expect(data.targets).toHaveLength(2);
		// The saved meal and the food only it refers to (dependency closure).
		expect(data.savedMeals).toHaveLength(1);
		expect(data.savedMeals[0].items.map((i) => i.kind)).toEqual(['food', 'quick', 'food']);
		expect(data.foods.find((f) => f.name === 'Ayran')?.id).toBe(data.savedMeals[0].items[2].foodId);
		expect(data.account).toMatchObject({ displayName: 'Mehmet', profile: { heightCm: 180 } });
		expect(data.account.reminders).toMatchObject({ times: { lunch: '14:00', weigh_in: '08:30' } });
		expect(JSON.stringify(data)).not.toContain('push.example');
		expect(data.account.modelChoices).toMatchObject({ speak: 'openai', scan: 'server' });
		expect(data.account.modelChoices?.speakAllowedAt).toEqual(expect.any(String));
		expect(JSON.stringify(data)).not.toContain(MEHMET_KEY);
		expect(JSON.stringify(data)).not.toContain('5678');

		const names = Object.fromEntries(
			data.foods.map((f) => [f.name + (f.mine ? '' : ' (built-in)'), f])
		);
		expect(Object.keys(names).sort()).toEqual([
			'Annemin böreği',
			'Ayran (built-in)',
			'Ayranlı tost',
			'Eski yoğurt',
			'Premium Light Ekmek',
			'Premium Light Ekmek (built-in)'
		]);
		// The built-in bread: content only, not the installation's provenance; nothing says shared any more.
		const builtInBread = data.foods.find((f) => !f.mine && f.name === 'Premium Light Ekmek')!;
		expect(builtInBread).toMatchObject({ sourceMeta: null, origin: 'curated' });
		expect(builtInBread).not.toHaveProperty('visibility');
		expect(data.foods.filter((f) => f.mine)).toHaveLength(4);
		// The recipe travels with its pinned ingredients; its food is among the person's own.
		expect(data.recipes).toHaveLength(1);
		expect(data.recipes[0]).toMatchObject({ servings: 2, cookedYieldG: 240 });
		expect(data.recipes[0].ingredients.map((i) => i.food.name)).toEqual([
			'Premium Light Ekmek',
			'Ayran'
		]);
		expect(names['Annemin böreği'].nutrients).toContainEqual({
			code: 'sugars',
			value: 0.5,
			qualifier: 'less_than'
		});
		expect(names['Eski yoğurt'].archivedAt).not.toBeNull();
	});

	it('says whether an export is small enough to import back', async () => {
		await buildHistory();
		expect(fitsImport(await portability.exportArchive(MEHMET))).toBe(true);
		// Over the unpacked limit, however small the zip.
		const huge = zipSync({ 'data/diary.json': new Uint8Array(LIMITS.unpackedBytes + 1) });
		expect(fitsImport(huge)).toBe(false);
	});

	it('detects a damaged or altered archive before reading anything', async () => {
		await buildHistory();
		const files = unzipSync(await portability.exportArchive(MEHMET));
		const tampered = { ...files, 'data/weight.json': strToU8('[]') };
		expect(() => readArchive(zipSync(tampered))).toThrow(ArchiveError);
		// A file the manifest lists, missing from the archive (a convenience CSV too).
		const withoutCsv = { ...files };
		delete withoutCsv['csv/diary.csv'];
		expect(() => readArchive(zipSync(withoutCsv))).toThrow(/missing_file: csv\/diary.csv/);
		const extra = { ...files, '../escape.txt': strToU8('x') };
		expect(() => readArchive(zipSync(extra))).toThrow(/unexpected_file/);
		expect(() => readArchive(strToU8('not a zip'))).toThrow(/not_an_archive/);
		const bad = JSON.parse(strFromU8(files['data/water.json']));
		bad[0].ml = -5;
		const badBytes = strToU8(JSON.stringify(bad));
		const manifest = JSON.parse(strFromU8(files['manifest.json']));
		manifest.files.find((f: { path: string }) => f.path === 'data/water.json').sha256 =
			sha256(badBytes);
		expect(() =>
			readArchive(
				zipSync({
					...files,
					'data/water.json': badBytes,
					'manifest.json': strToU8(JSON.stringify(manifest))
				})
			)
		).toThrow(/invalid_content/);
	});
});

describe('import', () => {
	it('round-trips into another account on another installation with the same meaning', async () => {
		await buildHistory();
		const archive = fromElsewhere(await portability.exportArchive(MEHMET));
		const preview = await portability.previewImport(ZEYNEP, archive);
		expect(preview).toMatchObject({
			sameInstallation: false,
			alreadyImported: false,
			dateRange: { from: '2026-10-01', to: '2026-10-03' },
			warnings: []
		});
		expect(preview.counts.diary).toEqual({ new: 6, unchanged: 0, changed: 0, skipped: 0 });
		expect(await count('diary_entries', ZEYNEP)).toBe(0); // the preview wrote nothing

		await applyImport(ZEYNEP, archive);
		// Settings come along, and count as saved.
		expect(await goals.preferences(ZEYNEP)).toMatchObject({
			preferences: {
				language: 'tr',
				palette: 'kaset',
				appIcon: 'zerde',
				timeFormat: '24',
				themeMode: 'system'
			},
			saved: true
		});
		const before = readArchive(archive).data;
		const after = readArchive(await portability.exportArchive(ZEYNEP)).data;
		expect(semantic(after)).toEqual(semantic(before));
		// Everything imported is Zeynep's own, including her copies of the other installation's built-in foods.
		expect(after.foods.every((f) => f.mine && f.origin !== 'curated')).toBe(true);
		const ids = new Set(before.diary.map((e) => e.id));
		expect(after.diary.some((e) => ids.has(e.id))).toBe(false);
		// Two identical quick adds stay two entries.
		expect(after.diary.filter((e) => e.description === 'Çay ve simit')).toHaveLength(2);
		// The saved meal arrives private, linked to Zeynep's own copies, and can be logged.
		expect(preview.counts.saved_meal).toEqual({ new: 1, unchanged: 0, changed: 0, skipped: 0 });
		const [meal] = await savedMeals.list(ZEYNEP);
		const full = await savedMeals.get(ZEYNEP, meal.id);
		const zeynepsFoods = new Set(after.foods.map((f) => f.id));
		expect(full.items.every((i) => !i.foodId || zeynepsFoods.has(i.foodId))).toBe(true);
		await savedMeals.log(
			ZEYNEP,
			meal.id,
			{ localDate: '2026-10-20', meal: 'breakfast', ...ist },
			full.items.map((i) => ({ itemId: i.id, entryId: randomUUID() }))
		);
		expect(await diary.day(ZEYNEP, '2026-10-20')).toHaveLength(3);

		// Importing the same content again (a new export of it) adds no second copy of the meal.
		const again = fromElsewhere(
			await portability.exportArchive(MEHMET),
			readArchive(archive).manifest.sourceInstallation
		);
		expect((await portability.previewImport(ZEYNEP, again)).counts.saved_meal).toEqual({
			new: 0,
			unchanged: 1,
			changed: 0,
			skipped: 0
		});
	});

	it('carries foods and saved meals in Recently deleted, still deleted, into another account', async () => {
		await buildHistory();
		const gone = await catalog.createFood(
			MEHMET,
			food({
				name: 'Silinen kraker',
				basis: '100g',
				nutrients: [{ code: 'energy_kcal', value: 450, qualifier: 'reported' }],
				servings: []
			})
		);
		await catalog.setArchived(MEHMET, gone, true);
		await catalog.bulk(MEHMET, 'delete', { ids: [gone] });
		const [meal] = await savedMeals.list(MEHMET);
		await savedMeals.remove(MEHMET, meal.id);

		const archive = fromElsewhere(await portability.exportArchive(MEHMET));
		const sent = readArchive(archive).data;
		expect(sent.foods.find((f) => f.name === 'Silinen kraker')?.deletedAt).toEqual(
			expect.any(String)
		);
		expect(sent.savedMeals[0].deletedAt).toEqual(expect.any(String));

		await applyImport(ZEYNEP, archive);
		// Nowhere in use, and both waiting in Recently deleted, where they can be restored.
		expect(await savedMeals.list(ZEYNEP)).toEqual([]);
		const [deletedMeal] = await savedMeals.trash(ZEYNEP);
		expect(deletedMeal.name).toBe(meal.name);
		const trash = await catalog.trash(ZEYNEP);
		expect(trash.map((f) => f.name)).toEqual(['Silinen kraker']);
		expect(
			(await catalog.ownFoods(ZEYNEP, 0, 50, { archived: true })).foods.map((f) => f.name)
		).not.toContain('Silinen kraker');
		await catalog.bulk(ZEYNEP, 'undelete', { ids: [trash[0].id] });
		await savedMeals.restore(ZEYNEP, [deletedMeal.id]);
		expect(await savedMeals.list(ZEYNEP)).toHaveLength(1);
	});

	it('exports day notes and imports them, keeping whichever version was typed last', async () => {
		const DAY = '2026-10-25';
		const diary = createDiary(db);
		await diary.saveDayNote(MEHMET, DAY, 'from the archive', new Date('2026-10-25T10:00:00Z'));
		await diary.saveDayNote(
			MEHMET,
			'2026-10-24',
			'also from the archive',
			new Date('2026-10-24T10:00:00Z')
		);
		await diary.saveDayNote(MEHMET, '2026-10-23', '', new Date('2026-10-23T10:00:00Z')); // emptied, nothing here
		await diary.saveDayNote(
			ZEYNEP,
			'2026-10-24',
			'typed later here',
			new Date('2026-10-24T12:00:00Z')
		);
		const archive = fromElsewhere(await portability.exportArchive(MEHMET));
		expect(
			readArchive(archive)
				.data.dayNotes.map((n) => n.localDate)
				.sort()
		).toEqual(['2026-10-23', '2026-10-24', DAY]);
		expect((await portability.previewImport(ZEYNEP, archive)).counts.dayNote).toMatchObject({
			new: 1,
			unchanged: 2
		});
		await applyImport(ZEYNEP, archive);
		expect((await diary.dayNote(ZEYNEP, DAY)).text).toBe('from the archive');
		expect((await diary.dayNote(ZEYNEP, '2026-10-24')).text).toBe('typed later here');
	});

	it('never adds again what was deleted and purged here, however many overlapping imports follow', async () => {
		const S = randomUUID();
		const at = (localDate: string) => ({ localDate, meal: 'lunch' as const, ...ist });
		const kraker = await catalog.createFood(
			MEHMET,
			food({
				name: 'Kraker',
				basis: '100g',
				nutrients: [{ code: 'energy_kcal', value: 450, qualifier: 'reported' }],
				servings: []
			})
		);
		await diary.quickAdd(MEHMET, { ...at('2026-10-20'), id: randomUUID() }, 350, 'Lunch out');
		await diary.logFood(MEHMET, at('2026-10-20'), await catalog.getFood(MEHMET, kraker), 50, grams);
		await applyImport(ZEYNEP, fromElsewhere(await portability.exportArchive(MEHMET), S));

		// Zeynep deletes all of it; a month later the nightly purge removes it for good.
		for (const e of await diary.day(ZEYNEP, '2026-10-20')) await diary.remove(ZEYNEP, e.id);
		const [mine] = (await catalog.ownFoods(ZEYNEP, 0, 50)).foods;
		await catalog.setArchived(ZEYNEP, mine.id, true);
		await catalog.bulk(ZEYNEP, 'delete', { ids: [mine.id] });
		await admin`update diary_entries set deleted_at = now() - interval '40 days' where user_id = ${ZEYNEP}`;
		await admin`update foods set deleted_at = now() - interval '40 days' where owner_id = ${ZEYNEP}`;
		await workerSql`select * from app_purge_trash(now() - interval '30 days')`;

		// Mehmet's later exports overlap the first and add a new entry of the same food.
		await diary.logFood(MEHMET, at('2026-10-21'), await catalog.getFood(MEHMET, kraker), 30, grams);
		const second = fromElsewhere(await portability.exportArchive(MEHMET), S);
		const preview = await portability.previewImport(ZEYNEP, second);
		expect(preview.counts.diary).toMatchObject({ new: 1, skipped: 2 });
		expect(preview.counts.food).toMatchObject({ new: 0, skipped: 1 });
		expect(preview.warnings).toContain('purged_skipped');
		await applyImport(ZEYNEP, second);
		await diary.quickAdd(MEHMET, { ...at('2026-10-22'), id: randomUUID() }, 90, 'Tea');
		await applyImport(ZEYNEP, fromElsewhere(await portability.exportArchive(MEHMET), S));

		expect(await diary.day(ZEYNEP, '2026-10-20')).toEqual([]);
		const [later] = await diary.day(ZEYNEP, '2026-10-21');
		expect(later).toMatchObject({ foodId: null }); // its food is gone: it keeps its own snapshot
		expect(await diary.day(ZEYNEP, '2026-10-21')).toHaveLength(1);
		expect(await diary.day(ZEYNEP, '2026-10-22')).toHaveLength(1);
		expect((await catalog.ownFoods(ZEYNEP, 0, 50)).foods).toEqual([]);
	});

	it('imports an emptied note over an older one, so the cleared text does not come back', async () => {
		const DAY = '2026-10-25';
		await diary.saveDayNote(ZEYNEP, DAY, 'old text', new Date('2026-10-25T09:00:00Z'));
		await diary.saveDayNote(MEHMET, DAY, '', new Date('2026-10-25T10:00:00Z'));
		const archive = fromElsewhere(await portability.exportArchive(MEHMET));
		await applyImport(ZEYNEP, archive);
		expect((await diary.dayNote(ZEYNEP, DAY)).text).toBe('');
	});

	it("keeps a note saved while the import runs when it was typed after the archive's", async () => {
		const DAY = '2026-10-25';
		await diary.saveDayNote(ZEYNEP, DAY, 'before', new Date('2026-10-25T09:00:00Z'));
		await diary.saveDayNote(MEHMET, DAY, 'from the archive', new Date('2026-10-25T10:00:00Z'));
		const archive = fromElsewhere(await portability.exportArchive(MEHMET));
		// The note's row is held, so the import plans with the old note and then waits to write it; meanwhile a
		// newer edit is saved, as from the person's phone.
		let importing: Promise<unknown> | undefined;
		await admin.begin(async (tx) => {
			await tx`select 1 from day_notes where user_id = ${ZEYNEP} and local_date = ${DAY} for update`;
			importing = applyImport(ZEYNEP, archive);
			await new Promise((r) => setTimeout(r, 500));
			await tx`update day_notes set text = 'typed during the import', typed_at = '2026-10-25T11:00:00Z'
				where user_id = ${ZEYNEP} and local_date = ${DAY}`;
		});
		await importing;
		expect((await diary.dayNote(ZEYNEP, DAY)).text).toBe('typed during the import');
	});

	it('reads an archive made before saved meals were exported', async () => {
		await buildHistory();
		const files = unzipSync(fromElsewhere(await portability.exportArchive(MEHMET)));
		delete files['data/saved-meals.json'];
		const manifest = JSON.parse(strFromU8(files['manifest.json']));
		manifest.files = manifest.files.filter(
			(f: { path: string }) => f.path !== 'data/saved-meals.json'
		);
		files['manifest.json'] = strToU8(JSON.stringify(manifest));
		const older = zipSync(files);
		expect(readArchive(older).data.savedMeals).toEqual([]);
		await applyImport(ZEYNEP, older);
		expect(await savedMeals.list(ZEYNEP)).toEqual([]);
		expect(await count('diary_entries', ZEYNEP)).toBe(6);
	});

	it('refuses the same file twice and adds only what is new from an overlapping later export', async () => {
		await buildHistory();
		const first = fromElsewhere(await portability.exportArchive(MEHMET), AYSE);
		await applyImport(ZEYNEP, first);
		expect((await portability.previewImport(ZEYNEP, first)).alreadyImported).toBe(true);
		await expect(applyImport(ZEYNEP, first)).rejects.toThrow(PortabilityError);

		await diary.quickAdd(
			MEHMET,
			{ localDate: '2026-10-04', meal: 'lunch', ...ist },
			120,
			'Çay ve simit'
		);
		const second = fromElsewhere(
			await portability.exportArchive(MEHMET, new Date('2026-10-05T00:00:00Z')),
			AYSE
		);
		const preview = await portability.previewImport(ZEYNEP, second);
		expect(preview.counts.diary).toEqual({ new: 1, unchanged: 6, changed: 0, skipped: 0 });
		expect(preview.counts.food.new).toBe(0);
		await applyImport(ZEYNEP, second);
		expect(await count('diary_entries', ZEYNEP)).toBe(7);
		expect(await count('weight_entries', ZEYNEP)).toBe(2);
	});

	it('imports two overlapping exports sent at the same moment, adding each record once', async () => {
		await buildHistory();
		const first = fromElsewhere(await portability.exportArchive(MEHMET), AYSE);
		await diary.quickAdd(
			MEHMET,
			{ localDate: '2026-10-04', meal: 'lunch', ...ist },
			120,
			'Çay ve simit'
		);
		const second = fromElsewhere(
			await portability.exportArchive(MEHMET, new Date('2026-10-05T00:00:00Z')),
			AYSE
		);
		// Both previews first, then both imports at once. Without one import at a time, both plan the same records
		// as new: they would be added twice, or the second would fail on a row both add (her profile, her settings).
		// The second to run finds its plan changed by the first and is refused with the new one (A15).
		const [a, b] = await Promise.all([
			portability.previewImport(ZEYNEP, first),
			portability.previewImport(ZEYNEP, second)
		]);
		const results = await Promise.allSettled([
			portability.applyImport(ZEYNEP, first, a.confirm),
			portability.applyImport(ZEYNEP, second, b.confirm)
		]);
		const refused = results.filter((r) => r.status === 'rejected');
		expect(refused).toHaveLength(1);
		const error = (refused[0] as PromiseRejectedResult).reason as PortabilityError;
		expect(error.code).toBe('plan_changed');
		const again = error.summary as { confirm: string };
		await portability.applyImport(
			ZEYNEP,
			results[0].status === 'rejected' ? first : second,
			again.confirm
		);
		expect(await count('diary_entries', ZEYNEP)).toBe(7);
		expect(await count('weight_entries', ZEYNEP)).toBe(2);
	});

	it('counts settings it would import, so an archive with nothing else still has something to import', async () => {
		await buildHistory();
		const archive = fromElsewhere(await portability.exportArchive(MEHMET), AYSE);
		await applyImport(ZEYNEP, archive);
		await admin`delete from reminder_settings where user_id = ${ZEYNEP}`;
		// The same records again (another file), now only the reminder times are new to her (A17).
		const again = fromElsewhere(
			await portability.exportArchive(MEHMET, new Date('2026-10-06')),
			AYSE
		);
		const preview = await portability.previewImport(ZEYNEP, again);
		expect(preview.counts.diary.new).toBe(0);
		expect(preview.counts.settings).toMatchObject({ new: 1, unchanged: 1 });
		await portability.applyImport(ZEYNEP, again, preview.confirm);
		const [row] =
			await admin`select count(*)::int as n from reminder_settings where user_id = ${ZEYNEP}`;
		expect(row.n).toBe(1);
	});

	it('imports only what the preview showed: a stale or missing confirmation is refused with the new plan', async () => {
		await buildHistory();
		const archive = fromElsewhere(await portability.exportArchive(MEHMET), AYSE);
		await expect(portability.applyImport(ZEYNEP, archive, '')).rejects.toMatchObject({
			code: 'plan_changed'
		});
		const preview = await portability.previewImport(ZEYNEP, archive);
		expect(preview.counts.diary.new).toBe(6);
		// Another device adds one of the same records before this import runs: the plan is no longer the preview.
		await applyImport(
			ZEYNEP,
			fromElsewhere(await portability.exportArchive(MEHMET, new Date('2026-10-06')), AYSE)
		);
		await expect(portability.applyImport(ZEYNEP, archive, preview.confirm)).rejects.toMatchObject({
			code: 'plan_changed',
			summary: { counts: { diary: { new: 0 } } }
		});
		expect(await count('diary_entries', ZEYNEP)).toBe(6);
	});

	it('keeps the current version of changed records, existing targets and an existing profile', async () => {
		const { borek } = await buildHistory();
		const archive = await portability.exportArchive(MEHMET);
		// Same account, same installation: everything matches.
		const same = await portability.previewImport(MEHMET, archive);
		expect(same.sameInstallation).toBe(true);
		expect(same.counts.diary).toEqual({ new: 0, unchanged: 6, changed: 0, skipped: 0 });
		expect(same.counts.food).toMatchObject({ new: 0, unchanged: 6 });
		expect(same.counts.saved_meal).toEqual({ new: 0, unchanged: 1, changed: 0, skipped: 0 });

		const [entry] = await diary.day(MEHMET, '2026-10-01');
		await diary.update(MEHMET, entry.id, entry.revision, { meal: 'lunch' });
		await goals.saveProfile(MEHMET, { heightCm: 181, birthDate: '1990-05-01', sex: 'male' });
		await catalog.setArchived(MEHMET, borek, true);
		const [meal] = await savedMeals.list(MEHMET);
		await savedMeals.rename(MEHMET, meal.id, meal.revision, 'Pazar');
		const changed = await portability.previewImport(MEHMET, archive);
		expect(changed.counts.saved_meal).toMatchObject({ changed: 1 });
		expect(changed.counts.diary).toMatchObject({ unchanged: 5, changed: 1 });
		expect(changed.counts.profile).toMatchObject({ skipped: 1 });
		expect(changed.warnings).toEqual(expect.arrayContaining(['changed_kept', 'profile_kept']));
		await applyImport(MEHMET, archive);
		expect((await diary.get(MEHMET, entry.id)).meal).toBe('lunch');
		expect((await goals.profile(MEHMET))?.heightCm).toBe(181);
		expect(await count('diary_entries', MEHMET)).toBe(6);
		expect((await savedMeals.list(MEHMET)).map((m) => m.name)).toEqual(['Pazar']);

		// Someone with targets of their own keeps them; imported history never changes their budgets.
		await goals.setTarget(
			ZEYNEP,
			{ mode: 'manual', effectiveFrom: '2026-01-01', budgetKcal: 1900 },
			null
		);
		const other = await portability.previewImport(ZEYNEP, archive);
		expect(other.counts.target).toEqual({ new: 0, unchanged: 0, changed: 0, skipped: 2 });
		expect(other.warnings).toContain('targets_kept');
		await applyImport(ZEYNEP, archive);
		expect((await goals.targetFor(ZEYNEP, '2026-10-05'))?.baseBurnKcal).toBe(1900);
	});

	it('links to a built-in food on the same installation instead of copying it', async () => {
		const { ekmek } = await buildHistory();
		const archive = await portability.exportArchive(MEHMET);
		const preview = await portability.previewImport(ZEYNEP, archive);
		// Mehmet's own foods are invisible to Zeynep and become her copies; the built-in bread and ayran are reused.
		expect(preview.counts.food).toEqual({ new: 4, unchanged: 2, changed: 0, skipped: 0 });
		await applyImport(ZEYNEP, archive);
		// Her copy of the recipe is a working recipe of her own, its ingredients linked to foods she can see.
		const [recipe] = await admin`select food_id from recipes where owner_id = ${ZEYNEP}`;
		const ingredients = await admin`select food_id from recipe_ingredients
			where recipe_id = ${recipe.food_id} order by position`;
		expect(ingredients).toHaveLength(2);
		expect(ingredients.every((i) => i.food_id !== null)).toBe(true);
		// The same file again is refused, so no second ingredient list appears.
		await expect(applyImport(ZEYNEP, archive)).rejects.toThrow('already_imported');
		expect(await admin`select 1 from recipes where owner_id = ${ZEYNEP}`).toHaveLength(1);
		const linked = await admin`select food_id from diary_entries
			where user_id = ${ZEYNEP} and local_date = '2026-10-01' and meal = 'breakfast'`;
		expect(linked[0].food_id).toBe(ekmek);
		// Mehmet cannot see Zeynep's copies.
		const seen = await appSql.begin(async (tx) => {
			await tx`select set_config('app.user_id', ${MEHMET}, true)`;
			return tx`select name from foods where owner_id = ${ZEYNEP}`;
		});
		expect(seen).toHaveLength(0);
	});

	it('reads an export from before foods were private: their shared flag is ignored, someone else’s food becomes a copy', async () => {
		await buildHistory();
		// As an older version wrote it: every food says who could see it, and the bread was a member's shared food.
		const files = unzipSync(await portability.exportArchive(MEHMET));
		const older = JSON.parse(strFromU8(files['data/foods.json'])).map(
			(f: { mine: boolean; name: string; origin: string }) => ({
				...f,
				visibility: f.mine ? 'private' : 'shared',
				origin: !f.mine && f.name === 'Premium Light Ekmek' ? 'manual' : f.origin
			})
		);
		const bytes = strToU8(JSON.stringify(older));
		const manifest = JSON.parse(strFromU8(files['manifest.json']));
		manifest.files.find((f: { path: string }) => f.path === 'data/foods.json').sha256 =
			sha256(bytes);
		const archive = fromElsewhere(
			zipSync({
				...files,
				'data/foods.json': bytes,
				'manifest.json': strToU8(JSON.stringify(manifest))
			})
		);
		await applyImport(ZEYNEP, archive);
		const hers =
			await admin`select name, origin, derived_from from foods where owner_id = ${ZEYNEP}`;
		expect(hers.map((f) => f.origin)).not.toContain('curated');
		expect(
			hers
				.filter((f) => f.name === 'Premium Light Ekmek')
				.map((f) => f.origin)
				.sort()
		).toEqual(['manual', 'variant']);
		// The bread (his variant's source) is no longer built-in in this archive, so the variant keeps no source;
		// the built-in ayran becomes her copy.
		expect(hers.find((f) => f.name === 'Ayran')?.origin).toBe('variant');
		expect(hers.every((f) => f.derived_from === null)).toBe(true);
		expect(await diary.day(ZEYNEP, '2026-10-01')).toHaveLength(2);
	});

	it('leaves nothing behind when an import fails part-way', async () => {
		await buildHistory();
		const files = unzipSync(fromElsewhere(await portability.exportArchive(MEHMET)));
		// Valid for the archive, but refused by the database: a weight that rounds to 700 kg.
		const entries = JSON.parse(strFromU8(files['data/weight.json']));
		entries.push({ ...entries[0], id: randomUUID(), kg: 699.999 });
		const bytes = strToU8(JSON.stringify(entries));
		const manifest = JSON.parse(strFromU8(files['manifest.json']));
		manifest.files.find((f: { path: string }) => f.path === 'data/weight.json').sha256 =
			sha256(bytes);
		const archive = zipSync({
			...files,
			'data/weight.json': bytes,
			'manifest.json': strToU8(JSON.stringify(manifest))
		});
		await expect(applyImport(ZEYNEP, archive)).rejects.toThrow();
		for (const table of ['diary_entries', 'weight_entries', 'import_files', 'import_identities'])
			expect(await count(table, ZEYNEP)).toBe(0);
	});
});

describe('account deletion', () => {
	it('removes everything of the person’s in one step, foods included', async () => {
		const { ekmek } = await buildHistory();
		await admin`insert into credentials (id, user_id, public_key, device_type, backed_up, label)
			values ('cred-m', ${MEHMET}, 'pk', 'multiDevice', true, 'iPhone')`;
		expect(await count('credentials', MEHMET)).toBe(1);
		const zeynepsOwn = await catalog.createFood(
			ZEYNEP,
			food({
				name: 'Zeynep’s soup',
				basis: '100g',
				nutrients: [{ code: 'energy_kcal', value: 56, qualifier: 'reported' }]
			})
		);

		await portability.deleteAccount(MEHMET, MEHMET);
		for (const table of [
			'diary_entries',
			'weight_entries',
			'water_entries',
			'activity_entries',
			'goal_versions',
			'profiles',
			'day_completions',
			'day_notes',
			'credentials',
			'sessions',
			'reminder_settings',
			'push_subscriptions',
			'model_keys',
			'model_choices',
			'model_usage'
		])
			expect(await count(table, MEHMET)).toBe(0);
		expect(await admin`select 1 from users where id = ${MEHMET}`).toHaveLength(0);
		expect(await admin`select 1 from foods where owner_id = ${MEHMET}`).toHaveLength(0);
		expect(await admin`select 1 from recipes`).toHaveLength(0);
		// Built-in foods and other people's foods stay.
		expect(await admin`select 1 from foods where id = ${ekmek}`).toHaveLength(1);
		expect(await admin`select 1 from foods where id = ${zeynepsOwn}`).toHaveLength(1);

		// The admin sees an opaque ID and the date; members see nothing.
		const list = await portability.deletions(AYSE);
		expect(list).toEqual([{ accountId: MEHMET, deletedAt: expect.any(String), by: 'self' }]);
		expect(await portability.deletions(ZEYNEP)).toEqual([]);
	});

	it('lets only the person or an admin delete an account, and never the last admin', async () => {
		await expect(portability.deleteAccount(ZEYNEP, MEHMET)).rejects.toMatchObject({
			code: 'forbidden'
		});
		await expect(portability.deleteAccount(AYSE, AYSE)).rejects.toMatchObject({
			code: 'last_admin'
		});
		await expect(portability.deleteAccount(AYSE, randomUUID())).rejects.toMatchObject({
			code: 'not_found'
		});
		await portability.deleteAccount(AYSE, ZEYNEP);
		expect(await portability.deletions(AYSE)).toMatchObject([{ accountId: ZEYNEP, by: 'admin' }]);
		// The runtime role cannot write the deletion list or delete users directly.
		const direct = appSql.begin(async (tx) => {
			await tx`select set_config('app.user_id', ${AYSE}, true)`;
			await tx`insert into account_deletions (account_id, by) values (${randomUUID()}, 'admin')`;
		});
		await expect(direct).rejects.toMatchObject({ code: '42501' });
		const del = appSql.begin(async (tx) => {
			await tx`select set_config('app.user_id', ${MEHMET}, true)`;
			await tx`delete from users where id = ${MEHMET}`;
		});
		await expect(del).rejects.toMatchObject({ code: '42501' });
	});
});

describe('reapplying deletions after a restore', () => {
	it('deletes the account again as it was deleted, and only the operator can run it', async () => {
		const own = await catalog.createFood(
			MEHMET,
			food({
				name: 'Mercimek çorbası',
				basis: '100g',
				nutrients: [{ code: 'energy_kcal', value: 56, qualifier: 'reported' }],
				servings: []
			})
		);
		await diary.quickAdd(MEHMET, { localDate: '2026-10-01', meal: 'lunch', ...ist }, 300, 'Simit');
		const [{ existed }] = await admin`select app_reapply_deletion(${MEHMET}::uuid,
			'2026-10-20T10:00:00Z') as existed`;
		expect(existed).toBe(true);
		expect(await count('diary_entries', MEHMET)).toBe(0);
		expect(await admin`select 1 from foods where id = ${own}`).toHaveLength(0);
		const [listed] = await admin`select deleted_at from account_deletions
			where account_id = ${MEHMET}`;
		expect(listed.deleted_at.toISOString()).toBe('2026-10-20T10:00:00.000Z');
		// Running the list again is harmless.
		const [{ again }] = await admin`select app_reapply_deletion(${MEHMET}::uuid, now()) as again`;
		expect(again).toBe(false);

		const asApp = appSql.begin(async (tx) => {
			await tx`select set_config('app.user_id', ${AYSE}, true)`;
			await tx`select app_reapply_deletion(${ZEYNEP}::uuid, now())`;
		});
		await expect(asApp).rejects.toMatchObject({ code: '42501' });
	});
});
