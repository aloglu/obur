// Purging the trash after 30 days, against real PostgreSQL: the worker role runs the reviewed function, and a late
// retry of a purged client ID is refused rather than recreating the record.
import { randomUUID } from 'node:crypto';
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { afterAll, beforeEach, describe, expect, inject, it } from 'vitest';
import { BodyError, createBody } from '../body/index.ts';
import { createDiary, DiaryError } from './service.ts';

const urls = inject('db');
const quiet = { onnotice: () => {} };
const admin = postgres(urls.admin, { max: 1, ...quiet });
const appSql = postgres(urls.app, { max: 2, ...quiet });
const workerSql = postgres(urls.worker, { max: 1, ...quiet });
const diary = createDiary(drizzle(appSql));
const body = createBody(drizzle(appSql));

const MEHMET = randomUUID();
const ctx = { localDate: '2026-09-01', meal: 'lunch' as const, zone: 'Europe/Istanbul' };
const day = { localDate: '2026-09-01', zone: 'Europe/Istanbul' };

beforeEach(async () => {
	await admin`truncate users cascade`;
	await admin`insert into users (id, display_name) values (${MEHMET}, 'Mehmet')`;
});

afterAll(async () => {
	await Promise.all([admin.end(), appSql.end(), workerSql.end()]);
});

const purge = (cutoff: string) =>
	workerSql`select kind, purged::int from app_purge_trash(${cutoff}::timestamptz) order by kind`;

describe('trash purge', () => {
	it('removes only trash older than the cutoff and blocks late retries of the same IDs', async () => {
		const old = await diary.quickAdd(MEHMET, { ...ctx, id: randomUUID() }, 300, 'Simit');
		const recent = await diary.quickAdd(MEHMET, { ...ctx, id: randomUUID() }, 200, 'Çay');
		const kept = await diary.quickAdd(MEHMET, ctx, 100, 'Live');
		const water = await body.logWater(MEHMET, { ...day, id: randomUUID() }, 250);
		await diary.remove(MEHMET, old.id);
		await diary.remove(MEHMET, recent.id);
		await body.removeWater(MEHMET, water.id);
		await admin`update diary_entries set deleted_at = now() - interval '40 days' where id = ${old.id}`;
		await admin`update water_entries set deleted_at = now() - interval '40 days' where id = ${water.id}`;

		const counts = await purge(new Date(Date.now() - 31 * 86400_000).toISOString());
		expect(counts.map((r) => ({ ...r }))).toEqual([
			{ kind: 'diary', purged: 1 },
			{ kind: 'water', purged: 1 }
		]);
		const left =
			await admin`select id from diary_entries where user_id = ${MEHMET} order by created_at`;
		expect(left.map((r) => r.id)).toEqual([recent.id, kept.id]);

		// A save sent again with the same ID (a lost answer, an older version's queue): refused as gone, not recreated.
		await expect(diary.quickAdd(MEHMET, { ...ctx, id: old.id }, 300, 'Simit')).rejects.toEqual(
			new DiaryError('gone')
		);
		await expect(body.logWater(MEHMET, { ...day, id: water.id }, 250)).rejects.toEqual(
			new BodyError('gone')
		);
		expect(await admin`select 1 from diary_entries where id = ${old.id}`).toHaveLength(0);
		// Markers are private and minimal.
		const [marker] = await admin`select * from purged_records where id = ${old.id}`;
		expect(Object.keys(marker).sort()).toEqual(['id', 'kind', 'purged_at', 'user_id']);
	});

	it('refuses a cutoff inside the 30-day undo window and is not available to the app role', async () => {
		await expect(purge(new Date().toISOString())).rejects.toMatchObject({ code: '22023' });
		const asApp = appSql.begin(async (tx) => {
			await tx`select set_config('app.user_id', ${MEHMET}, true)`;
			await tx`select * from app_purge_trash(now() - interval '60 days')`;
		});
		await expect(asApp).rejects.toMatchObject({ code: '42501' });
		const write = appSql.begin(async (tx) => {
			await tx`select set_config('app.user_id', ${MEHMET}, true)`;
			await tx`insert into purged_records (id, user_id, kind) values (${randomUUID()}, ${MEHMET}, 'diary')`;
		});
		await expect(write).rejects.toMatchObject({ code: '42501' });
	});
});

describe('housekeeping', () => {
	it('removes only expired sessions, old reminder sends and spent links, run by the worker alone', async () => {
		const session = (hash: string, expires: string, seen: string) =>
			admin`insert into sessions (user_id, token_hash, expires_at, last_seen_at)
				values (${MEHMET}, ${hash}, now() + ${expires}::interval, now() - ${seen}::interval)`;
		await session('live', '30 days', '1 day');
		await session('expired', '-1 day', '1 day');
		await session('idle', '30 days', '15 days');
		await admin`insert into reminder_sends (user_id, kind, local_date, sent_at) values
			(${MEHMET}, 'lunch', '2026-01-01', now() - interval '40 days'),
			(${MEHMET}, 'dinner', '2026-01-02', now() - interval '1 day')`;
		await admin`insert into recovery_links (user_id, token_hash, expires_at) values
			(${MEHMET}, 'old', now() - interval '40 days'), (${MEHMET}, 'new', now() + interval '1 hour')`;

		const rows = await workerSql`select kind, removed::int from app_housekeeping() order by kind`;
		expect(Object.fromEntries(rows.map((r) => [r.kind, r.removed]))).toEqual({
			bootstrap_tokens: 0,
			recovery_links: 1,
			reminder_sends: 1,
			sessions: 2
		});
		expect((await admin`select token_hash from sessions`).map((r) => r.token_hash)).toEqual([
			'live'
		]);
		expect((await admin`select kind from reminder_sends`).map((r) => r.kind)).toEqual(['dinner']);
		expect((await admin`select token_hash from recovery_links`).map((r) => r.token_hash)).toEqual([
			'new'
		]);
		const asApp = appSql.begin(async (tx) => {
			await tx`select set_config('app.user_id', ${MEHMET}, true)`;
			await tx`select * from app_housekeeping()`;
		});
		await expect(asApp).rejects.toMatchObject({ code: '42501' });
	});
});

describe('purging deleted foods and saved meals', () => {
	it('removes them after 30 days; entries keep their snapshot, and a retried saved meal stays gone', async () => {
		const { createCatalog } = await import('../catalog/index.ts');
		const { createSavedMeals } = await import('./saved-meals.ts');
		const catalog = createCatalog(drizzle(appSql));
		const saved = createSavedMeals(drizzle(appSql));
		const id = await catalog.createFood(MEHMET, {
			name: 'Simit',
			brand: null,
			basis: '100g',
			servingLabel: null,
			servingSize: null,
			barcode: null,
			icon: null,
			nutrients: [{ code: 'energy_kcal', value: 275, qualifier: 'reported' }],
			servings: []
		});
		const food = await catalog.getFood(MEHMET, id);
		const entry = await diary.logFood(MEHMET, ctx, food, 100, { kind: 'mass', unit: 'g' });
		const meal = await saved.createFromEntries(MEHMET, { name: 'Breakfast', entryIds: [entry.id] });
		await catalog.bulk(MEHMET, 'archive', { ids: [id] });
		await catalog.bulk(MEHMET, 'delete', { ids: [id] });
		await saved.remove(MEHMET, meal.id);
		await admin`update foods set deleted_at = now() - interval '40 days' where id = ${id}`;
		await admin`update saved_meals set deleted_at = now() - interval '40 days' where id = ${meal.id}`;

		const counts = await purge(new Date(Date.now() - 31 * 86400_000).toISOString());
		expect(counts.map((r) => ({ ...r }))).toEqual([
			{ kind: 'food', purged: 1 },
			{ kind: 'saved_meal', purged: 1 }
		]);
		expect(await admin`select id from foods where id = ${id}`).toHaveLength(0);
		const kept = await diary.get(MEHMET, entry.id);
		expect(kept).toMatchObject({ foodId: null, food: { name: 'Simit' } });
		expect(kept.nutrients.energy_kcal?.value).toBe(275);
		await expect(
			saved.createFromEntries(MEHMET, { id: meal.id, name: 'Breakfast', entryIds: [entry.id] })
		).rejects.toEqual(new DiaryError('gone'));
	});

	it('keeps foods and saved meals deleted less than 30 days ago', async () => {
		const { createSavedMeals } = await import('./saved-meals.ts');
		const saved = createSavedMeals(drizzle(appSql));
		const entry = await diary.quickAdd(MEHMET, ctx, 100, 'Tea');
		const meal = await saved.createFromEntries(MEHMET, { name: 'Tea', entryIds: [entry.id] });
		await saved.remove(MEHMET, meal.id);
		expect(await purge(new Date(Date.now() - 31 * 86400_000).toISOString())).toHaveLength(0);
		expect(await saved.trashCount(MEHMET)).toBe(1);
	});
});
