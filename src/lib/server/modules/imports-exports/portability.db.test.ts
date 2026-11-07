// Export, import and account deletion against real PostgreSQL, run as the runtime role.
import { randomUUID } from 'node:crypto';
import { drizzle } from 'drizzle-orm/postgres-js';
import { strFromU8, strToU8, unzipSync, zipSync } from 'fflate';
import postgres from 'postgres';
import * as v from 'valibot';
import { afterAll, beforeEach, describe, expect, inject, it } from 'vitest';
import { FoodInput } from '../../../shared/food-input.ts';
import { createBody } from '../body/index.ts';
import { createCatalog, createRecipes } from '../catalog/index.ts';
import { createDiary, createSavedMeals } from '../diary/index.ts';
import { createGoals } from '../goals/index.ts';
import { createReminders } from '../reminders/index.ts';
import { createRemoteModels } from '../remote-models/index.ts';
import { ArchiveError, readArchive, sha256, type PortableData } from './archive.ts';
import { createPortability, PortabilityError } from './service.ts';

const urls = inject('db');
const quiet = { onnotice: () => {} };
const admin = postgres(urls.admin, { max: 1, ...quiet });
const appSql = postgres(urls.app, { max: 2, ...quiet });
const db = drizzle(appSql);
const catalog = createCatalog(db);
const diary = createDiary(db);
const body = createBody(db);
const goals = createGoals(db);
const savedMeals = createSavedMeals(db);
const recipes = createRecipes(db);
const portability = createPortability(db);
const reminders = createReminders(db);
const remoteModels = createRemoteModels(db, Buffer.alloc(32, 7));
const MEHMET_KEY = 'sk-portability-test-key-0123456789';

const AYSE = randomUUID(); // admin
const MEHMET = randomUUID();
const ZEYNEP = randomUUID();
const ist = { zone: 'Europe/Istanbul' };
const grams = { kind: 'mass', unit: 'g' } as const;

const food = (input: Record<string, unknown>) => v.parse(FoodInput, input);

beforeEach(async () => {
	await admin`truncate users, account_deletions cascade`;
	await admin`insert into users (id, display_name, role) values
		(${AYSE}, 'Ayşe', 'admin'), (${MEHMET}, 'Mehmet', 'member'), (${ZEYNEP}, 'Zeynep', 'member')`;
});

afterAll(async () => {
	await Promise.all([admin.end(), appSql.end()]);
});

/**
 * A complex history for Mehmet: a shared food someone else made, his own private serving-only food with an
 * unknown nutrient and a "less than" value, an archived food, a variant, two identical quick adds, trash, weight,
 * water, counted and uncounted activity, targets, a profile, a completed day, and a saved meal whose shared food
 * (Ayran) no diary entry refers to any more, as after its entry was purged from the trash.
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
	const ekmek = await catalog.createFood(
		AYSE,
		food({
			name: 'Premium Light Ekmek',
			brand: 'Untad',
			visibility: 'shared',
			basis: '100g',
			nutrients: [
				{ code: 'energy_kcal', value: 193, qualifier: 'reported' },
				{ code: 'carbohydrate_excl_fibre', value: 42.4, qualifier: 'reported' }
			],
			servings: [{ name: 'dilim', amount: 26, unit: 'g' }]
		})
	);
	const borek = await catalog.createFood(
		MEHMET,
		food({
			name: 'Annemin böreği',
			icon: '1F967',
			visibility: 'private',
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
			visibility: 'private',
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

	const ayran = await catalog.createFood(
		AYSE,
		food({
			name: 'Ayran',
			visibility: 'shared',
			basis: '100ml',
			nutrients: [{ code: 'energy_kcal', value: 38, qualifier: 'reported' }],
			servings: []
		})
	);
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
	// A private recipe from the person's own bread and the shared ayran, weighed after cooking.
	await recipes.save(MEHMET, {
		id: randomUUID(),
		version: null,
		name: 'Ayranlı tost',
		visibility: 'private',
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
			data.foods.map((f) => [f.name + (f.mine ? '' : ' (shared)'), f])
		);
		expect(Object.keys(names).sort()).toEqual([
			'Annemin böreği',
			'Ayran (shared)',
			'Ayranlı tost',
			'Eski yoğurt',
			'Premium Light Ekmek',
			'Premium Light Ekmek (shared)'
		]);
		// Ayşe's shared bread: content only, not her provenance.
		const shared = data.foods.find((f) => !f.mine)!;
		expect(shared).toMatchObject({ name: 'Premium Light Ekmek', sourceMeta: null });
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

	it('detects a damaged or altered archive before reading anything', async () => {
		await buildHistory();
		const files = unzipSync(await portability.exportArchive(MEHMET));
		const tampered = { ...files, 'data/weight.json': strToU8('[]') };
		expect(() => readArchive(zipSync(tampered))).toThrow(ArchiveError);
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

		await portability.applyImport(ZEYNEP, archive);
		// Settings come along, and count as saved.
		expect(await goals.preferences(ZEYNEP)).toMatchObject({
			preferences: { palette: 'kaset', appIcon: 'zerde', timeFormat: '24', themeMode: 'system' },
			saved: true
		});
		const before = readArchive(archive).data;
		const after = readArchive(await portability.exportArchive(ZEYNEP)).data;
		expect(semantic(after)).toEqual(semantic(before));
		// Everything imported is Zeynep's own and private, including the copy of the shared bread.
		expect(after.foods.every((f) => f.mine && f.visibility === 'private')).toBe(true);
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
		await diary.saveDayNote(MEHMET, '2026-10-23', '', new Date('2026-10-23T10:00:00Z')); // emptied: nothing to export
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
		).toEqual(['2026-10-24', DAY]);
		expect((await portability.previewImport(ZEYNEP, archive)).counts.dayNote).toMatchObject({
			new: 1,
			unchanged: 1
		});
		await portability.applyImport(ZEYNEP, archive);
		expect((await diary.dayNote(ZEYNEP, DAY)).text).toBe('from the archive');
		expect((await diary.dayNote(ZEYNEP, '2026-10-24')).text).toBe('typed later here');
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
		await portability.applyImport(ZEYNEP, older);
		expect(await savedMeals.list(ZEYNEP)).toEqual([]);
		expect(await count('diary_entries', ZEYNEP)).toBe(6);
	});

	it('refuses the same file twice and adds only what is new from an overlapping later export', async () => {
		await buildHistory();
		const first = fromElsewhere(await portability.exportArchive(MEHMET), AYSE);
		await portability.applyImport(ZEYNEP, first);
		expect((await portability.previewImport(ZEYNEP, first)).alreadyImported).toBe(true);
		await expect(portability.applyImport(ZEYNEP, first)).rejects.toThrow(PortabilityError);

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
		await portability.applyImport(ZEYNEP, second);
		expect(await count('diary_entries', ZEYNEP)).toBe(7);
		expect(await count('weight_entries', ZEYNEP)).toBe(2);
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
		await portability.applyImport(MEHMET, archive);
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
		await portability.applyImport(ZEYNEP, archive);
		expect((await goals.targetFor(ZEYNEP, '2026-10-05'))?.baseBurnKcal).toBe(1900);
	});

	it('links to a shared food that is still visible on the same installation instead of copying it', async () => {
		const { ekmek } = await buildHistory();
		const archive = await portability.exportArchive(MEHMET);
		const preview = await portability.previewImport(ZEYNEP, archive);
		// Mehmet's own foods are invisible to Zeynep and become her private copies; Ayşe's shared bread is reused.
		expect(preview.counts.food).toEqual({ new: 4, unchanged: 2, changed: 0, skipped: 0 });
		await portability.applyImport(ZEYNEP, archive);
		// Her copy of the recipe is a working recipe of her own, its ingredients linked to foods she can see.
		const [recipe] = await admin`select food_id from recipes where owner_id = ${ZEYNEP}`;
		const ingredients = await admin`select food_id from recipe_ingredients
			where recipe_id = ${recipe.food_id} order by position`;
		expect(ingredients).toHaveLength(2);
		expect(ingredients.every((i) => i.food_id !== null)).toBe(true);
		// The same file again is refused, so no second ingredient list appears.
		await expect(portability.applyImport(ZEYNEP, archive)).rejects.toThrow('already_imported');
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
		await expect(portability.applyImport(ZEYNEP, archive)).rejects.toThrow();
		for (const table of ['diary_entries', 'weight_entries', 'import_files', 'import_identities'])
			expect(await count(table, ZEYNEP)).toBe(0);
	});
});

describe('account deletion', () => {
	it('removes everything private in one step and keeps shared foods for the household', async () => {
		const { ekmek } = await buildHistory();
		const shared = await catalog.createFood(
			MEHMET,
			food({
				name: 'Mercimek çorbası',
				visibility: 'shared',
				basis: '100g',
				nutrients: [{ code: 'energy_kcal', value: 56, qualifier: 'reported' }],
				servings: []
			})
		);
		await diary.logFood(
			ZEYNEP,
			{ localDate: '2026-10-01', meal: 'dinner', ...ist },
			await catalog.getFood(ZEYNEP, shared),
			300,
			grams
		);
		await admin`insert into credentials (id, user_id, public_key, device_type, backed_up, label)
			values ('cred-m', ${MEHMET}, 'pk', 'multiDevice', true, 'iPhone')`;
		expect(await count('credentials', MEHMET)).toBe(1);

		await portability.deleteAccount(MEHMET, MEHMET, false);
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
		// His shared soup stays, without an owner; Zeynep's entry keeps its link and snapshot.
		const [soup] = await admin`select owner_id from foods where id = ${shared}`;
		expect(soup.owner_id).toBeNull();
		const [entry] =
			await admin`select food_id, food->>'name' as name from diary_entries where user_id = ${ZEYNEP}`;
		expect(entry).toMatchObject({ food_id: shared, name: 'Mercimek çorbası' });
		expect(await admin`select 1 from foods where id = ${ekmek}`).toHaveLength(1);

		// The admin sees an opaque ID and the date; members see nothing.
		const list = await portability.deletions(AYSE);
		expect(list).toEqual([
			{ accountId: MEHMET, deletedAt: expect.any(String), by: 'self', removedSharedFoods: false }
		]);
		expect(await portability.deletions(ZEYNEP)).toEqual([]);
	});

	it('removes shared foods too when asked, keeping other people’s snapshots', async () => {
		const shared = await catalog.createFood(
			MEHMET,
			food({
				name: 'Mercimek çorbası',
				visibility: 'shared',
				basis: '100g',
				nutrients: [{ code: 'energy_kcal', value: 56, qualifier: 'reported' }],
				servings: []
			})
		);
		await diary.logFood(
			ZEYNEP,
			{ localDate: '2026-10-01', meal: 'dinner', ...ist },
			await catalog.getFood(ZEYNEP, shared),
			300,
			grams
		);
		await portability.deleteAccount(MEHMET, MEHMET, true);
		expect(await admin`select 1 from foods where id = ${shared}`).toHaveLength(0);
		// The choice is kept in the deletion list, so a restore can reapply it.
		const [listed] =
			await admin`select removed_shared_foods from account_deletions where account_id = ${MEHMET}`;
		expect(listed.removed_shared_foods).toBe(true);
		const [entry] =
			await admin`select food_id, energy_kcal from diary_entries where user_id = ${ZEYNEP}`;
		expect(entry.food_id).toBeNull();
		expect(Number(entry.energy_kcal)).toBe(168);
	});

	it('lets only the person or an admin delete an account, and never the last admin', async () => {
		await expect(portability.deleteAccount(ZEYNEP, MEHMET, false)).rejects.toMatchObject({
			code: 'forbidden'
		});
		await expect(portability.deleteAccount(AYSE, AYSE, false)).rejects.toMatchObject({
			code: 'last_admin'
		});
		await expect(portability.deleteAccount(AYSE, randomUUID(), false)).rejects.toMatchObject({
			code: 'not_found'
		});
		await portability.deleteAccount(AYSE, ZEYNEP, false);
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
		const shared = await catalog.createFood(
			MEHMET,
			food({
				name: 'Mercimek çorbası',
				visibility: 'shared',
				basis: '100g',
				nutrients: [{ code: 'energy_kcal', value: 56, qualifier: 'reported' }],
				servings: []
			})
		);
		await diary.quickAdd(MEHMET, { localDate: '2026-10-01', meal: 'lunch', ...ist }, 300, 'Simit');
		const [{ existed }] = await admin`select app_reapply_deletion(${MEHMET}::uuid, true,
			'2026-10-20T10:00:00Z') as existed`;
		expect(existed).toBe(true);
		expect(await count('diary_entries', MEHMET)).toBe(0);
		expect(await admin`select 1 from foods where id = ${shared}`).toHaveLength(0);
		const [listed] = await admin`select deleted_at, removed_shared_foods from account_deletions
			where account_id = ${MEHMET}`;
		expect(listed.deleted_at.toISOString()).toBe('2026-10-20T10:00:00.000Z');
		expect(listed.removed_shared_foods).toBe(true);
		// Running the list again is harmless.
		const [{ again }] =
			await admin`select app_reapply_deletion(${MEHMET}::uuid, true, now()) as again`;
		expect(again).toBe(false);

		const asApp = appSql.begin(async (tx) => {
			await tx`select set_config('app.user_id', ${AYSE}, true)`;
			await tx`select app_reapply_deletion(${ZEYNEP}::uuid, false, now())`;
		});
		await expect(asApp).rejects.toMatchObject({ code: '42501' });
	});
});
