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

		// The offline queue retries with the same ID: refused as gone, not recreated.
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
