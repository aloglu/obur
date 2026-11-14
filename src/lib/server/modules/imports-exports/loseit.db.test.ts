// LoseIt import against real PostgreSQL, run as the runtime role, with the invented fixture (tests/fixtures/loseit).
import { randomUUID } from 'node:crypto';
import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { drizzle } from 'drizzle-orm/postgres-js';
import { strToU8, zipSync } from 'fflate';
import postgres from 'postgres';
import { afterAll, beforeEach, describe, expect, inject, it } from 'vitest';
import { createGoals } from '../goals/index.ts';
import type { LoseItOptions } from './loseit-import.ts';
import { createPortability, PortabilityError } from './service.ts';

const urls = inject('db');
const quiet = { onnotice: () => {} };
const admin = postgres(urls.admin, { max: 1, ...quiet });
const appSql = postgres(urls.app, { max: 2, ...quiet });
const db = drizzle(appSql);
const portability = createPortability(db);
const goals = createGoals(db);

const MEHMET = randomUUID();
const ZEYNEP = randomUUID();
const options: LoseItOptions = {
	zone: 'Europe/Istanbul',
	weightUnit: 'kg',
	shareFoods: false,
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

		await portability.applyLoseIt(MEHMET, zip(), options);
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
		await portability.applyLoseIt(MEHMET, zip(), options);
		const foods =
			await admin`select name, visibility, origin, basis from foods where owner_id = ${MEHMET}`;
		expect(foods.every((f) => f.visibility === 'private' && f.origin === 'loseit')).toBe(true);
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

	it('can share custom foods, while foods taken from LoseIt’s database stay private', async () => {
		await portability.applyLoseIt(MEHMET, zip(), { ...options, shareFoods: true });
		const rows = await admin`select name, visibility, source_meta->>'loseit' as kind from foods
			where owner_id = ${MEHMET}`;
		expect(
			rows.filter((r) => r.kind === 'custom food').every((r) => r.visibility === 'shared')
		).toBe(true);
		expect(
			rows.filter((r) => r.kind !== 'custom food').every((r) => r.visibility === 'private')
		).toBe(true);
	});

	it('keeps LoseIt’s budgets for past days, records activity without counting it, and imports the rest', async () => {
		await portability.applyLoseIt(MEHMET, zip(), options);
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
		await portability.applyLoseIt(MEHMET, zip(), { ...options, weightUnit: 'lb' });
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
		await portability.applyLoseIt(MEHMET, zip(), options);
		expect((await goals.targetFor(MEHMET, '2026-01-05'))?.baseBurnKcal).toBe(2150);
		expect((await goals.targetFor(MEHMET, '2026-01-07'))?.baseBurnKcal).toBe(2000);
	});

	it('refuses the same file twice; a later overlapping export adds only new rows and offers missing ones for the trash', async () => {
		await portability.applyLoseIt(MEHMET, zip(), options);
		expect((await portability.previewLoseIt(MEHMET, zip(), options)).alreadyImported).toBe(true);
		await expect(portability.applyLoseIt(MEHMET, zip(), options)).rejects.toThrow(PortabilityError);

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
		await portability.applyLoseIt(MEHMET, zip(later), { ...options, trashMissing: true });
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

	it('remembers what was imported from LoseIt after a move to another installation by export and import', async () => {
		await portability.applyLoseIt(MEHMET, zip(), options);
		const archive = await portability.exportArchive(MEHMET);
		// A fresh installation: no accounts, another installation ID.
		await admin`truncate users cascade`;
		await admin`insert into users (id, display_name) values (${MEHMET}, 'Mehmet'), (${ZEYNEP}, 'Zeynep')`;
		await admin`update installation set id = ${randomUUID()}`;
		await portability.applyImport(MEHMET, archive);

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
		await portability.applyLoseIt(MEHMET, zip(later), { ...options, trashMissing: true });
		const live = await admin`select food->>'name' as n from diary_entries
			where user_id = ${MEHMET} and deleted_at is null`;
		expect(live).toHaveLength(18);
		expect(live.map((r) => r.n)).not.toContain('Banana');
		// What Mehmet imported says nothing about anyone else's account.
		const theirs = await portability.previewLoseIt(ZEYNEP, zip(later), options);
		expect(theirs.counts.diary.new).toBe(18);
	});

	it('leaves another person’s data alone', async () => {
		await portability.applyLoseIt(ZEYNEP, zip(), options);
		await portability.applyLoseIt(MEHMET, zip(), options);
		expect(await dayTotals(ZEYNEP)).toEqual(await dayTotals(MEHMET));
		expect((await admin`select count(*)::int as n from diary_entries`)[0].n).toBe(36);
	});
});
