// LoseIt import against real PostgreSQL, run as the runtime role, with the invented fixture (tests/fixtures/loseit).
import { randomUUID } from 'node:crypto';
import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { drizzle } from 'drizzle-orm/postgres-js';
import { strToU8, zipSync } from 'fflate';
import postgres from 'postgres';
import { afterAll, beforeEach, describe, expect, inject, it } from 'vitest';
import * as v from 'valibot';
import { FoodInput } from '../../../shared/food-input.ts';
import { createCatalog } from '../catalog/index.ts';
import { createGoals } from '../goals/index.ts';
import type { LoseItOptions } from './loseit-import.ts';
import { createPortability, PortabilityError } from './service.ts';
import { saveProfile } from '../../../../../tests/db/profile.ts';

const urls = inject('db');
const quiet = { onnotice: () => {} };
const admin = postgres(urls.admin, { max: 1, ...quiet });
const appSql = postgres(urls.app, { max: 2, ...quiet });
const db = drizzle(appSql);
const portability = createPortability(db);
// An import as the page makes it: the preview first, then the import with what it showed.
const applyImport = async (userId: string, bytes: Uint8Array) =>
	portability.applyImport(userId, bytes, (await portability.previewImport(userId, bytes)).confirm);
const applyLoseIt = async (userId: string, bytes: Uint8Array, o: LoseItOptions) =>
	portability.applyLoseIt(
		userId,
		bytes,
		o,
		(await portability.previewLoseIt(userId, bytes, o)).confirm
	);
const goals = createGoals(db);

const MEHMET = randomUUID();
const ZEYNEP = randomUUID();
const options: LoseItOptions = {
	zone: 'Europe/Istanbul',
	weightUnit: 'kg',
	trashMissing: false
};

const FIXTURE = path.resolve(import.meta.dirname, '../../../../../tests/fixtures/loseit');
const files = Object.fromEntries(
	readdirSync(FIXTURE)
		.filter((f) => f.endsWith('.csv'))
		.map((f) => [f, readFileSync(path.join(FIXTURE, f), 'utf8')])
);
const zip = (f: Record<string, string> = files) =>
	zipSync(Object.fromEntries(Object.entries(f).map(([k, v]) => [k, strToU8(v)])), {
		// A fixed time: the same files must give the same bytes (zip stores the time to 2 s, so two zips built a
		// moment apart could differ, and the repeat-import check compares the file's hash).
		mtime: new Date('2026-01-01T00:00:00Z')
	});

beforeEach(async () => {
	await admin`truncate users cascade`;
	await admin`insert into users (id, display_name) values (${MEHMET}, 'Mehmet'), (${ZEYNEP}, 'Zeynep')`;
});

afterAll(async () => {
	await Promise.all([admin.end(), appSql.end()]);
});

const dayTotals = async (userId: string) =>
	Object.fromEntries(
		(
			await admin`select local_date::text as d, sum(energy_kcal)::float as kcal from diary_entries
				where user_id = ${userId} and deleted_at is null group by 1 order by 1`
		).map((r) => [r.d, r.kcal])
	);

describe('LoseIt import', () => {
	it('previews without writing, then imports entries that add up to LoseIt’s own daily totals', async () => {
		const preview = await portability.previewLoseIt(MEHMET, zip(), options);
		expect(preview).toMatchObject({
			source: 'loseit',
			alreadyImported: false,
			dateRange: { from: '2026-01-05', to: '2026-01-08' },
			deletedInLoseIt: 1,
			reconciliation: { days: 4, mismatched: [] },
			warnings: []
		});
		expect(preview.counts.diary).toEqual({ new: 18, unchanged: 0, missing: 0, skipped: 0 });
		expect((await admin`select count(*)::int as n from diary_entries`)[0].n).toBe(0);

		await applyLoseIt(MEHMET, zip(), options);
		expect(await dayTotals(MEHMET)).toEqual({
			'2026-01-05': 676.5,
			'2026-01-06': 1371,
			'2026-01-07': 745,
			'2026-01-08': 342
		});
		// Two identical eggs at one breakfast stay two entries; the deleted baklava is not there.
		const names = (
			await admin`select food->>'name' as n from diary_entries where user_id = ${MEHMET}`
		).map((r) => r.n);
		expect(names.filter((n) => n === 'Haşlanmış yumurta')).toHaveLength(2);
		expect(names).not.toContain('Baklava');
		// A calories-only database food keeps the rest unknown; salt is derived from sodium, sodium kept.
		const [walnuts] = await admin`select nutrients, zone, meal from diary_entries
			where user_id = ${MEHMET} and food->>'name' = 'Walnuts'`;
		// Only energy (and kJ derived from it, marked as derived); no macronutrient appears from nowhere.
		expect(Object.keys(walnuts.nutrients).sort()).toEqual(['energy_kcal', 'energy_kj']);
		expect(walnuts.nutrients.energy_kj.qualifier).toBe('derived');
		expect(walnuts).toMatchObject({ zone: 'Europe/Istanbul', meal: 'snacks' });
		const [ayran] = await admin`select nutrients from diary_entries
			where user_id = ${MEHMET} and food->>'name' = 'Ayran' and local_date = '2026-01-05'`;
		expect(ayran.nutrients.sodium.value).toBe(300);
		expect(ayran.nutrients.salt).toMatchObject({ qualifier: 'derived' });
		expect(ayran.nutrients.carbohydrate_unspecified.value).toBe(8);
	});

	it('imports foods privately, links diary rows to an unambiguous custom food, and never merges duplicates', async () => {
		await applyLoseIt(MEHMET, zip(), options);
		const foods = await admin`select name, origin, basis from foods where owner_id = ${MEHMET}`;
		expect(foods.every((f) => f.origin === 'loseit')).toBe(true);
		expect(foods.filter((f) => f.name === 'Mercimek çorbası')).toHaveLength(2);
		expect(foods.find((f) => f.name === 'Ekmek, tam buğday')?.basis).toBe('100g');
		// Ayran has one custom food: linked. Mercimek çorbası has two: left unlinked rather than guessed.
		const links = await admin`select e.food->>'name' as n, f.name as linked from diary_entries e
			left join foods f on f.id = e.food_id where e.user_id = ${MEHMET}`;
		expect(links.find((l) => l.n === 'Ayran')?.linked).toBe('Ayran');
		expect(links.filter((l) => l.n === 'Mercimek çorbası').every((l) => l.linked === null)).toBe(
			true
		);
		expect(links.find((l) => l.n === 'Banana')?.linked).toBe('Banana');
		// Zeynep sees none of them.
		const seen = await appSql.begin(async (tx) => {
			await tx`select set_config('app.user_id', ${ZEYNEP}, true)`;
			return tx`select 1 from foods where owner_id = ${MEHMET}`;
		});
		expect(seen).toHaveLength(0);
	});

	it('keeps LoseIt’s budgets for past days, records activity without counting it, and imports the rest', async () => {
		await applyLoseIt(MEHMET, zip(), options);
		expect((await goals.targetFor(MEHMET, '2026-01-05'))?.baseBurnKcal).toBe(2150);
		expect((await goals.targetFor(MEHMET, '2026-01-07'))?.baseBurnKcal).toBe(2121);
		expect(await goals.history(MEHMET)).toHaveLength(2);
		const activity = await admin`select kcal, counts_toward_budget, source from activity_entries
			where user_id = ${MEHMET} order by kcal`;
		expect(activity.map((a) => ({ ...a }))).toEqual([
			{ kcal: 212, counts_toward_budget: false, source: 'loseit' },
			{ kcal: 1050, counts_toward_budget: false, source: 'loseit' }
		]);
		const weights =
			await admin`select kg::float from weight_entries where user_id = ${MEHMET} order by local_date`;
		expect(weights.map((w) => w.kg)).toEqual([91.4, 91.1]);
		expect(
			(await admin`select count(*)::int as n from water_entries where user_id = ${MEHMET}`)[0].n
		).toBe(2);
		expect(
			(
				await admin`select local_date::text as d from day_completions where user_id = ${MEHMET} order by 1`
			).map((r) => r.d)
		).toEqual(['2026-01-05', '2026-01-06']);
		expect(await goals.profile(MEHMET)).toMatchObject({
			birthDate: '1990-04-15',
			sex: 'male',
			heightCm: 178
		});
	});

	it('converts pounds when the preview says the weights were in pounds', async () => {
		await applyLoseIt(MEHMET, zip(), { ...options, weightUnit: 'lb' });
		const weights =
			await admin`select kg::float from weight_entries where user_id = ${MEHMET} order by local_date`;
		expect(weights.map((w) => w.kg)).toEqual([41.46, 41.32]);
	});

	it('does not import LoseIt budgets from the day a target was set in obur', async () => {
		await goals.setTarget(
			MEHMET,
			{ mode: 'manual', effectiveFrom: '2026-01-06', budgetKcal: 2000 },
			null
		);
		const preview = await portability.previewLoseIt(MEHMET, zip(), options);
		expect(preview.warnings).toContain('budgets_after_own_target');
		await applyLoseIt(MEHMET, zip(), options);
		expect((await goals.targetFor(MEHMET, '2026-01-05'))?.baseBurnKcal).toBe(2150);
		expect((await goals.targetFor(MEHMET, '2026-01-07'))?.baseBurnKcal).toBe(2000);
	});

	it('refuses the same file twice; a later overlapping export adds only new rows and offers missing ones for the trash', async () => {
		await applyLoseIt(MEHMET, zip(), options);
		expect((await portability.previewLoseIt(MEHMET, zip(), options)).alreadyImported).toBe(true);
		await expect(applyLoseIt(MEHMET, zip(), options)).rejects.toThrow(PortabilityError);

		// The next export: the banana was deleted in LoseIt and a new row was logged.
		const lines = files['food-logs.csv'].split('\n');
		const later = {
			...files,
			'food-logs.csv': [
				...lines.filter((l) => !l.startsWith('1/7/2026,Banana')).filter((l) => l),
				'1/8/2026,Apple,Apple,Snacks,1.0,Each,95.0,0,0.3,0.5,25.0,0.0,19.0,4.4,0.0,2.0',
				''
			].join('\n')
		};
		const preview = await portability.previewLoseIt(MEHMET, zip(later), options);
		expect(preview.counts.diary).toEqual({ new: 1, unchanged: 17, missing: 1, skipped: 0 });
		expect(preview.warnings).toContain('missing_rows');
		await applyLoseIt(MEHMET, zip(later), { ...options, trashMissing: true });
		const live = await admin`select food->>'name' as n from diary_entries
			where user_id = ${MEHMET} and deleted_at is null`;
		expect(live.map((r) => r.n)).toContain('Apple');
		expect(live.map((r) => r.n)).not.toContain('Banana');
		const trashed = await admin`select food->>'name' as n from diary_entries
			where user_id = ${MEHMET} and deleted_at is not null`;
		expect(trashed.map((r) => r.n)).toEqual(['Banana']);
		// The two identical eggs are still two.
		expect(live.filter((r) => r.n === 'Haşlanmış yumurta')).toHaveLength(2);
	});

	it('offers missing rows of each kind only within that kind’s own dates in the later export', async () => {
		await applyLoseIt(MEHMET, zip(), options);
		// A later export whose weight file starts a day later than its diary: the 5 January weigh-in is outside the
		// weight file's dates, so it says nothing about that weigh-in (once counted as deleted, 2026-11-21 audit).
		const weights = files['weights.csv']
			.split('\n')
			.filter((l) => !l.startsWith('1/5/2026'))
			.join('\n');
		const later = {
			...files,
			'weights.csv': weights,
			'water-intake.csv': 'Date,Value,Secondary Value,Last Updated\n'
		};
		const preview = await portability.previewLoseIt(MEHMET, zip(later), options);
		expect(preview.counts.weight.missing).toBe(0);
		expect(preview.counts.water.missing).toBe(0);
		await applyLoseIt(MEHMET, zip(later), { ...options, trashMissing: true });
		const [{ n }] = await admin`select count(*)::int as n from weight_entries
			where user_id = ${MEHMET} and local_date = '2026-01-05' and deleted_at is null`;
		expect(n).toBe(1);
	});

	it('imports two water rows with the same date and value as two, and both once only (2026-11-21 audit, C02)', async () => {
		const twice = {
			...files,
			'water-intake.csv':
				files['water-intake.csv'] + '1/6/2026,2500.0,-1.0,2026-01-06T23:00:00+0300\n'
		};
		await applyLoseIt(MEHMET, zip(twice), options);
		const count = async () =>
			(
				await admin`select count(*)::int as n from water_entries
					where user_id = ${MEHMET} and local_date = '2026-01-06' and deleted_at is null`
			)[0].n;
		expect(await count()).toBe(2);
		// The same rows again in a later export: nothing new.
		const later = { ...twice, 'food-logs.csv': files['food-logs.csv'] + '\n' };
		expect((await portability.previewLoseIt(MEHMET, zip(later), options)).counts.water.new).toBe(0);
	});

	it('imports the LoseIt profile into a new account whose first page only saved settings (2026-11-22 audit, A04)', async () => {
		await goals.savePreferences(MEHMET, { weightUnit: 'lb', lengthUnit: 'in', waterUnit: 'floz' });
		const preview = await portability.previewLoseIt(MEHMET, zip(), options);
		expect(preview.counts.profile).toMatchObject({ new: 1 });
		expect(preview.warnings).not.toContain('profile_kept');
		await applyLoseIt(MEHMET, zip(), options);
		expect(await goals.profile(MEHMET)).toMatchObject({
			heightCm: 178,
			sex: 'male',
			birthDate: '1990-04-15'
		});
		expect((await goals.preferences(MEHMET)).preferences.weightUnit).toBe('lb');
		// Details the person entered are kept, as before.
		await saveProfile(admin, ZEYNEP, { heightCm: 165, birthDate: '1995-01-01', sex: 'female' });
		const other = await portability.previewLoseIt(ZEYNEP, zip(), options);
		expect(other.warnings).toContain('profile_kept');
	});

	it('reads a pounds account: height in inches, water in US fluid ounces (2026-11-22 audit, D02)', async () => {
		const us = {
			...files,
			'profile.csv': files['profile.csv'].replace('Height,178.0', 'Height,70.0'),
			'water-intake.csv':
				'Date,Value,Secondary Value,Last Updated\n1/5/2026,64.0,-1.0,2026-01-05T22:00:00+0300\n'
		};
		const o: LoseItOptions = { ...options, weightUnit: 'lb', waterUnit: 'floz' };
		const preview = await portability.previewLoseIt(MEHMET, zip(us), o);
		expect(preview.warnings).toContain('height_in_inches');
		expect(preview.warnings).not.toContain('height_out_of_range');
		expect(preview.mostWater).toBe(64);
		await applyLoseIt(MEHMET, zip(us), o);
		expect((await goals.profile(MEHMET))?.heightCm).toBe(177.8);
		const [{ ml }] =
			await admin`select ml::float as ml from water_entries where user_id = ${MEHMET}`;
		expect(ml).toBe(1892.7);
		// A metric export's height is untouched, with no note.
		const metric = await portability.previewLoseIt(ZEYNEP, zip(), options);
		expect(metric.warnings).not.toContain('height_in_inches');
	});

	it('converts fluid ounces from the value as written, and leaves out rows it cannot store (2026-11-22 audit, A05, A06)', async () => {
		const odd = {
			...files,
			'water-intake.csv':
				'Date,Value,Secondary Value,Last Updated\n' +
				'1/5/2026,8.5,-1.0,2026-01-05T22:00:00+0300\n1/6/2026,0.4,-1.0,2026-01-06T22:00:00+0300\n',
			'weights.csv':
				files['weights.csv'].trimEnd() + '\n1/7/2026,701.0,2026-01-07T08:00:00+0300,false\n'
		};
		const o: LoseItOptions = { ...options, waterUnit: 'floz' };
		const preview = await portability.previewLoseIt(MEHMET, zip(odd), o);
		expect(preview.counts.weight.skipped).toBe(1);
		expect(preview.warnings).toContain('rows_left_out');
		expect(preview.counts.water.new).toBe(2);
		// The import writes what the preview counted: no failure on the 701 kg row.
		await applyLoseIt(MEHMET, zip(odd), o);
		const water =
			await admin`select ml::float as ml from water_entries where user_id = ${MEHMET} order by local_date`;
		expect(water.map((w) => w.ml)).toEqual([251.4, 11.8]);
		const [{ n }] =
			await admin`select count(*)::int as n from weight_entries where user_id = ${MEHMET} and kg >= 700`;
		expect(n).toBe(0);
	});

	it('remembers what was imported from LoseIt after a move to another installation by export and import', async () => {
		await applyLoseIt(MEHMET, zip(), options);
		const archive = await portability.exportArchive(MEHMET);
		// A fresh installation: no accounts, another installation ID.
		await admin`truncate users cascade`;
		await admin`insert into users (id, display_name) values (${MEHMET}, 'Mehmet'), (${ZEYNEP}, 'Zeynep')`;
		await admin`update installation set id = ${randomUUID()}`;
		await applyImport(MEHMET, archive);

		const lines = files['food-logs.csv'].split('\n');
		const later = {
			...files,
			'food-logs.csv': [
				...lines.filter((l) => !l.startsWith('1/7/2026,Banana')).filter((l) => l),
				'1/8/2026,Apple,Apple,Snacks,1.0,Each,95.0,0,0.3,0.5,25.0,0.0,19.0,4.4,0.0,2.0',
				''
			].join('\n')
		};
		const preview = await portability.previewLoseIt(MEHMET, zip(later), options);
		expect(preview.counts.diary).toEqual({ new: 1, unchanged: 17, missing: 1, skipped: 0 });
		expect(preview.counts.food.new).toBe(1);
		expect(preview.counts.weight.new).toBe(0);
		expect(preview.counts.water.new).toBe(0);
		expect(preview.counts.activity.new).toBe(0);
		await applyLoseIt(MEHMET, zip(later), { ...options, trashMissing: true });
		const live = await admin`select food->>'name' as n from diary_entries
			where user_id = ${MEHMET} and deleted_at is null`;
		expect(live).toHaveLength(18);
		expect(live.map((r) => r.n)).not.toContain('Banana');
		// What Mehmet imported says nothing about anyone else's account.
		const theirs = await portability.previewLoseIt(ZEYNEP, zip(later), options);
		expect(theirs.counts.diary.new).toBe(18);
	});

	it('finds a database food with a long name again in a later export, also as earlier imports stored it', async () => {
		const name =
			`Grande caramel macchiato with oat milk and an extra shot ${'of something long '.repeat(4)}`.trim();
		const row = (day: number) =>
			`1/${day}/2026,${name},Coffee,Breakfast,1.0,Each,250.0,0,7.0,9.0,35.0,4.0,30.0,0.0,20.0,150.0`;
		const withRows = (...days: number[]) => ({
			...files,
			'food-logs.csv': [files['food-logs.csv'].trimEnd(), ...days.map(row), ''].join('\n')
		});
		await applyLoseIt(MEHMET, zip(withRows(7)), options);
		const later = await portability.previewLoseIt(MEHMET, zip(withRows(7, 8)), options);
		expect(later.counts.food.new).toBe(0);
		expect(later.counts.diary.new).toBe(1);
		// An earlier import kept the identity cut at 100 characters: still the same food.
		const cut =
			await admin`update import_identities set source_id = left('log:' || ${name.toLowerCase()}, 100)
			where user_id = ${MEHMET} and kind = 'food' and source_id like 'log:grande%'`;
		expect(cut.count).toBe(1);
		const again = await portability.previewLoseIt(MEHMET, zip(withRows(7, 8)), options);
		expect(again.counts.food.new).toBe(0);
	});

	it('leaves another person’s data alone', async () => {
		await applyLoseIt(ZEYNEP, zip(), options);
		await applyLoseIt(MEHMET, zip(), options);
		expect(await dayTotals(ZEYNEP)).toEqual(await dayTotals(MEHMET));
		expect((await admin`select count(*)::int as n from diary_entries`)[0].n).toBe(36);
	});
});

describe('already in your foods', () => {
	const catalog = createCatalog(drizzle(appSql));
	const own = (input: Record<string, unknown>) =>
		catalog.createFood(MEHMET, v.parse(FoodInput, { brand: null, servings: [], ...input }));

	it('uses the person’s own food instead of a copy, says so, and can keep copies instead', async () => {
		// The same bread (240 vs 245 kcal per 100 g) and ayran (95 kcal per 250 ml is 38 per 100 ml).
		const bread = await own({
			name: 'ekmek tam bugday',
			basis: '100g',
			nutrients: [{ code: 'energy_kcal', value: 245, qualifier: 'reported' }]
		});
		const ayran = await own({
			name: 'Ayran',
			brand: 'Örnek Süt',
			basis: '100ml',
			nutrients: [{ code: 'energy_kcal', value: 38, qualifier: 'reported' }]
		});
		// An archived one, and one with other calories, are not the same.
		const archived = await own({
			name: 'Haşlanmış yumurta',
			basis: 'serving',
			servingLabel: '1 Each',
			nutrients: [{ code: 'energy_kcal', value: 78, qualifier: 'reported' }]
		});
		await catalog.setArchived(MEHMET, archived, true);
		await own({
			name: 'Mercimek çorbası',
			basis: '100g',
			nutrients: [{ code: 'energy_kcal', value: 200, qualifier: 'reported' }]
		});

		const plain = await portability.previewLoseIt(MEHMET, zip(), options);
		const copies = await portability.previewLoseIt(MEHMET, zip(), { ...options, keepCopies: true });
		expect(plain.matchedFoods).toBe(2);
		expect(copies.matchedFoods).toBe(0);
		expect(plain.counts.food.new).toBe(copies.counts.food.new - 2);

		await applyLoseIt(MEHMET, zip(), options);
		const names =
			await admin`select name from foods where owner_id = ${MEHMET} and origin = 'loseit'`;
		expect(names.map((r) => r.name)).not.toContain('Ekmek, tam buğday');
		expect(names.map((r) => r.name)).not.toContain('Ayran');
		// LoseIt's two Mercimek çorbası are still both added: neither is the person's own.
		expect(names.filter((r) => r.name === 'Mercimek çorbası')).toHaveLength(2);
		const linked = await admin`select distinct food_id, food->>'name' as name from diary_entries
			where user_id = ${MEHMET} and food->>'name' in ('Ayran', 'Ekmek, tam buğday')`;
		expect(new Set(linked.map((r) => r.food_id))).toEqual(new Set([bread, ayran]));
		// Entries keep LoseIt's own values.
		const [row] = await admin`select energy_kcal from diary_entries
			where user_id = ${MEHMET} and food->>'name' = 'Ayran' limit 1`;
		expect(Number(row.energy_kcal)).toBe(95);

		// The next, overlapping export finds them again rather than adding them now.
		const again = await portability.previewLoseIt(
			MEHMET,
			zip({ ...files, 'profile.csv': files['profile.csv'] + '\n' }),
			options
		);
		expect(again.counts.food.new).toBe(0);
	});
});
