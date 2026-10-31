// Weight and water rules against real PostgreSQL, run as the runtime role.
import { randomUUID } from 'node:crypto';
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { afterAll, beforeEach, describe, expect, inject, it } from 'vitest';
import { BodyError, createBody } from './service.ts';

const urls = inject('db');
const quiet = { onnotice: () => {} };
const admin = postgres(urls.admin, { max: 1, ...quiet });
const appSql = postgres(urls.app, { max: 2, ...quiet });
const body = createBody(drizzle(appSql));

const AYSE = randomUUID();
const MEHMET = randomUUID();
const at = (localDate: string, id?: string) => ({ id, localDate, zone: 'Europe/Istanbul' });

async function errorCode(promise: Promise<unknown>): Promise<string | undefined> {
	try {
		await promise;
	} catch (e) {
		if (e instanceof BodyError) return e.code;
		const err = e as { code?: string; cause?: { code?: string } };
		return err.cause?.code ?? err.code;
	}
	return undefined;
}

const asUser = <T>(userId: string, run: (tx: postgres.TransactionSql) => Promise<T>) =>
	appSql.begin(async (tx) => {
		await tx`select set_config('app.user_id', ${userId}, true)`;
		return run(tx);
	}) as Promise<T>;

beforeEach(async () => {
	await admin`truncate users cascade`;
	await admin`insert into users (id, display_name) values (${AYSE}, 'Ayşe'), (${MEHMET}, 'Mehmet')`;
});

afterAll(async () => {
	await Promise.all([admin.end(), appSql.end()]);
});

describe('weight', () => {
	it('keeps separate readings with the same value and returns the latest', async () => {
		await body.logWeight(AYSE, at('2026-10-20'), 83.1);
		await body.logWeight(AYSE, at('2026-10-24'), 82.4);
		await body.logWeight(AYSE, at('2026-10-24'), 82.4); // a genuine second weigh-in
		expect(await body.weights(AYSE, '2026-10-01', '2026-10-31')).toHaveLength(3);
		expect((await body.latestWeight(AYSE, '2026-10-25'))?.value).toBe(82.4);
		expect((await body.latestWeight(AYSE, '2026-10-21'))?.value).toBe(83.1);
		expect(await body.latestWeight(AYSE, '2026-10-19')).toBeNull();
	});

	it('finds the first weigh-in day, ignoring deleted readings and other people', async () => {
		expect(await body.firstWeightDay(AYSE)).toBeNull();
		const early = await body.logWeight(AYSE, at('2026-09-01'), 85);
		await body.logWeight(AYSE, at('2026-09-03'), 84.6);
		await body.logWeight(MEHMET, at('2026-01-01'), 70);
		expect(await body.firstWeightDay(AYSE)).toBe('2026-09-01');
		await body.removeWeight(AYSE, early.id);
		expect(await body.firstWeightDay(AYSE)).toBe('2026-09-03');
	});

	it('treats a retry with the same ID as the same reading, and rejects changed content', async () => {
		const id = randomUUID();
		const first = await body.logWeight(AYSE, at('2026-10-24', id), 82.4);
		expect(await body.logWeight(AYSE, at('2026-10-24', id), 82.4)).toEqual(first);
		expect(await errorCode(body.logWeight(AYSE, at('2026-10-24', id), 80))).toBe('conflict');
		expect(await errorCode(body.logWeight(MEHMET, at('2026-10-24', id), 82.4))).toBe('conflict');
	});

	it('deletes to the trash and restores within 30 days only', async () => {
		const r = await body.logWeight(AYSE, at('2026-10-24'), 82.4);
		await body.removeWeight(AYSE, r.id);
		expect(await body.latestWeight(AYSE, '2026-10-25')).toBeNull();
		await body.restoreWeight(AYSE, r.id);
		expect((await body.latestWeight(AYSE, '2026-10-25'))?.value).toBe(82.4);
		await body.removeWeight(AYSE, r.id);
		await admin`update weight_entries set deleted_at = now() - interval '31 days'`;
		expect(await errorCode(body.restoreWeight(AYSE, r.id))).toBe('not_found');
	});
});

describe('weight pages', () => {
	it('pages newest first with a cursor, across gaps and same-day readings, skipping deleted ones', async () => {
		const days = ['2024-01-05', '2025-06-01', '2026-10-24', '2026-10-24', '2026-10-25'];
		const made = [];
		for (const [i, d] of days.entries()) made.push(await body.logWeight(AYSE, at(d), 80 + i));
		// Two readings in the same millisecond, as a cursor cannot tell them apart.
		await admin`update weight_entries set created_at = date_trunc('milliseconds', now()) where local_date = '2026-10-24'`;
		await body.removeWeight(AYSE, made[1].id);
		await body.logWeight(MEHMET, at('2026-10-26'), 70);

		const seen: number[] = [];
		let after: { localDate: string; createdAt: string; id: string } | undefined;
		for (;;) {
			const page = await body.weightPage(AYSE, 2, after);
			if (page.length === 0) break;
			seen.push(...page.map((r) => r.value));
			after = page.at(-1)!;
		}
		expect(seen).toHaveLength(4);
		expect(seen[0]).toBe(84);
		expect(seen.at(-1)).toBe(80);
		expect(new Set(seen.slice(1, 3))).toEqual(new Set([82, 83]));
	});
});

describe('activity', () => {
	it('adds workouts and takes only the newest watch total, per day and in the range totals', async () => {
		await body.logActivity(AYSE, at('2026-10-24'), 300, null, 'day_total');
		await body.logActivity(AYSE, at('2026-10-24'), 200, 'Yüzme');
		await new Promise((r) => setTimeout(r, 5));
		await body.logActivity(AYSE, at('2026-10-24'), 650, null, 'day_total');
		await body.logActivity(AYSE, at('2026-10-25'), 100, null);
		expect((await body.activityDay(AYSE, '2026-10-24')).countedKcal).toBe(850);
		expect(await body.activityByDay(AYSE, '2026-10-20', '2026-10-31')).toEqual(
			expect.arrayContaining([
				{ localDate: '2026-10-24', kcal: 850 },
				{ localDate: '2026-10-25', kcal: 100 }
			])
		);
		// A retry of the same total is the same entry; the kind is part of the request.
		const id = randomUUID();
		await body.logActivity(AYSE, at('2026-10-26', id), 400, null, 'day_total');
		expect(await errorCode(body.logActivity(AYSE, at('2026-10-26', id), 400, null, 'extra'))).toBe(
			'conflict'
		);
	});
});

describe('editing', () => {
	it('changes a value with the current revision and refuses a stale one', async () => {
		const r = await body.logWeight(AYSE, at('2026-10-24'), 82.4);
		const edited = await body.editWeight(AYSE, r.id, r.revision, 81.9);
		expect(edited).toMatchObject({ id: r.id, value: 81.9, revision: 2, localDate: '2026-10-24' });
		expect(await errorCode(body.editWeight(AYSE, r.id, r.revision, 80))).toBe('conflict');
		expect((await body.latestWeight(AYSE, '2026-10-25'))?.value).toBe(81.9);

		const w = await body.logWater(AYSE, at('2026-10-24'), 250);
		await body.editWater(AYSE, w.id, w.revision, 330);
		expect((await body.waterDay(AYSE, '2026-10-24')).totalMl).toBe(330);
	});

	it("refuses deleted readings, another person's readings and out-of-range values", async () => {
		const r = await body.logWeight(AYSE, at('2026-10-24'), 82.4);
		expect(await errorCode(body.editWeight(MEHMET, r.id, r.revision, 70))).toBe('not_found');
		const w = await body.logWater(AYSE, at('2026-10-24'), 250);
		expect(await errorCode(body.editWater(MEHMET, w.id, w.revision, 1))).toBe('not_found');
		expect((await body.latestWeight(AYSE, '2026-10-25'))?.value).toBe(82.4);
		// Even directly, the other person's update touches nothing.
		const touched = await asUser(MEHMET, (tx) => tx`update weight_entries set kg = 1 returning id`);
		expect(touched).toHaveLength(0);

		expect(await errorCode(body.editWeight(AYSE, r.id, r.revision, 900))).toBe('23514');
		await body.removeWeight(AYSE, r.id);
		expect(await errorCode(body.editWeight(AYSE, r.id, r.revision + 1, 80))).toBe('not_found');
	});
});

describe('water', () => {
	it('totals a day and respects deletion', async () => {
		const a = await body.logWater(AYSE, at('2026-10-25'), 250);
		await body.logWater(AYSE, at('2026-10-25'), 500);
		await body.logWater(AYSE, at('2026-10-24'), 1000);
		expect((await body.waterDay(AYSE, '2026-10-25')).totalMl).toBe(750);
		await body.removeWater(AYSE, a.id);
		expect((await body.waterDay(AYSE, '2026-10-25')).totalMl).toBe(500);
		await body.restoreWater(AYSE, a.id);
		expect((await body.waterDay(AYSE, '2026-10-25')).totalMl).toBe(750);
	});

	it('totals water per day over a range, for the person only', async () => {
		await body.logWater(AYSE, at('2026-10-20'), 250);
		await body.logWater(AYSE, at('2026-10-20'), 500);
		const gone = await body.logWater(AYSE, at('2026-10-21'), 300);
		await body.removeWater(AYSE, gone.id);
		await body.logWater(AYSE, at('2026-10-23'), 1000);
		await body.logWater(MEHMET, at('2026-10-22'), 2000);
		expect(await body.waterByDay(AYSE, '2026-10-20', '2026-10-31')).toEqual([
			{ localDate: '2026-10-20', ml: 750 },
			{ localDate: '2026-10-23', ml: 1000 }
		]);
	});
});

describe('isolation and constraints', () => {
	it('keeps readings per person', async () => {
		const w = await body.logWeight(AYSE, at('2026-10-24'), 82.4);
		await body.logWater(AYSE, at('2026-10-24'), 250);
		expect(await body.latestWeight(MEHMET, '2026-10-25')).toBeNull();
		expect((await body.waterDay(MEHMET, '2026-10-24')).totalMl).toBe(0);
		expect(await errorCode(body.removeWeight(MEHMET, w.id))).toBe('not_found');
		const changed = await asUser(
			MEHMET,
			(tx) => tx`update weight_entries set kg = 1 where id = ${w.id} returning id`
		);
		expect(changed).toHaveLength(0);
		expect(
			await errorCode(asUser(AYSE, (tx) => tx`update weight_entries set user_id = ${MEHMET}`))
		).toBe('42501');
		expect(await errorCode(asUser(AYSE, (tx) => tx`delete from water_entries`))).toBe('42501');
		expect(
			await errorCode(
				asUser(
					MEHMET,
					(tx) => tx`insert into water_entries (id, user_id, local_date, zone, ml)
					values (${randomUUID()}, ${AYSE}, '2026-10-24', 'UTC', 250)`
				)
			)
		).toBe('42501');
	});

	it('enforces plausible ranges in the database', async () => {
		const insert = (table: string, column: string, value: number) =>
			errorCode(
				asUser(AYSE, (tx) =>
					tx.unsafe(`insert into ${table} (id, user_id, local_date, zone, ${column})
						values ('${randomUUID()}', '${AYSE}', '2026-10-24', 'UTC', ${value})`)
				)
			);
		expect(await insert('weight_entries', 'kg', 0)).toBe('23514');
		expect(await insert('weight_entries', 'kg', 900)).toBe('23514');
		expect(await insert('water_entries', 'ml', -250)).toBe('23514');
		expect(await insert('water_entries', 'ml', 20000)).toBe('23514');
	});
});

describe('activity', () => {
	it('counts manual activity, but not imported activity with an unclear meaning', async () => {
		const run = await body.logActivity(AYSE, at('2026-10-25'), 300, 'Walk');
		await admin`insert into activity_entries (id, user_id, local_date, zone, kcal, source, counts_toward_budget)
			values (${randomUUID()}, ${AYSE}, '2026-10-25', 'UTC', 900, 'loseit', false)`;
		const day = await body.activityDay(AYSE, '2026-10-25');
		expect(day.countedKcal).toBe(300);
		expect(day.entries).toHaveLength(2);
		await body.removeActivity(AYSE, run.id);
		expect((await body.activityDay(AYSE, '2026-10-25')).countedKcal).toBe(0);
		await body.restoreActivity(AYSE, run.id);
		expect((await body.activityDay(AYSE, '2026-10-25')).countedKcal).toBe(300);
	});

	it('is idempotent by ID, private, and manual entries always count', async () => {
		const id = randomUUID();
		const a = await body.logActivity(AYSE, at('2026-10-25', id), 300, null);
		expect(await body.logActivity(AYSE, at('2026-10-25', id), 300, null)).toEqual(a);
		expect(await errorCode(body.logActivity(AYSE, at('2026-10-25', id), 400, null))).toBe(
			'conflict'
		);
		expect((await body.activityDay(MEHMET, '2026-10-25')).entries).toEqual([]);
		expect(
			await errorCode(
				asUser(
					AYSE,
					(
						tx
					) => tx`insert into activity_entries (id, user_id, local_date, zone, kcal, counts_toward_budget)
					values (${randomUUID()}, ${AYSE}, '2026-10-25', 'UTC', 100, false)`
				)
			)
		).toBe('23514');
	});
});

it('sums counted activity per day', async () => {
	await body.logActivity(AYSE, at('2026-10-01'), 200, null);
	await body.logActivity(AYSE, at('2026-10-01'), 100, null);
	await admin`insert into activity_entries (id, user_id, local_date, zone, kcal, source, counts_toward_budget)
		values (${randomUUID()}, ${AYSE}, '2026-10-01', 'UTC', 900, 'loseit', false)`;
	await body.logActivity(MEHMET, at('2026-10-01'), 700, null);
	expect(await body.activityByDay(AYSE, '2026-10-01', '2026-10-31')).toEqual([
		{ localDate: '2026-10-01', kcal: 300 }
	]);
});
