// Achievements against real PostgreSQL, run as the runtime role: kept in step with the records, private to their
// person, celebrated once.
import { randomUUID } from 'node:crypto';
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { afterAll, beforeEach, describe, expect, it, inject } from 'vitest';
import { createProgress } from './service.ts';

const urls = inject('db');
const quiet = { onnotice: () => {} };
const admin = postgres(urls.admin, { max: 1, ...quiet });
const appSql = postgres(urls.app, { max: 2, ...quiet });
const service = createProgress(drizzle(appSql));
// The list only; whether weight applies is checked where it matters.
const progress = {
	...service,
	sync: async (...args: Parameters<typeof service.sync>) => (await service.sync(...args)).list
};

const AYSE = randomUUID();
const MEHMET = randomUUID();
const TODAY = '2026-10-31';
const ZONE = 'Europe/Istanbul';

const asUser = <T>(userId: string, run: (tx: postgres.TransactionSql) => Promise<T>) =>
	appSql.begin(async (tx) => {
		await tx`select set_config('app.user_id', ${userId}, true)`;
		return run(tx);
	}) as Promise<T>;

async function adult(userId: string, goalKg: number | null = 80) {
	await admin`insert into profiles (user_id, birth_date) values (${userId}, '1990-01-01')`;
	await admin`insert into goal_versions (user_id, effective_from, mode, base_burn_kcal, deficit_kcal, goal_weight_kg,
		inputs, calculation_version) values (${userId}, '2026-01-01', 'calculated', 2500, 700, ${goalKg}, '{}', 'test')`;
}
async function weigh(userId: string, localDate: string, kg: number) {
	const id = randomUUID();
	await admin`insert into weight_entries (id, user_id, local_date, zone, kg)
		values (${id}, ${userId}, ${localDate}, ${ZONE}, ${kg})`;
	return id;
}
const keys = (list: { kind: string; level: unknown; seen: boolean }[]) =>
	list.map((a) => `${a.kind}:${a.level}${a.seen ? '' : ' (new)'}`);

beforeEach(async () => {
	await admin`truncate users cascade`;
	await admin`insert into users (id, display_name) values (${AYSE}, 'Ayşe'), (${MEHMET}, 'Mehmet')`;
});

afterAll(async () => {
	await Promise.all([admin.end(), appSql.end()]);
});

describe('achievements', () => {
	it('arrive quietly when reached long ago and wait to be celebrated when recent', async () => {
		await adult(AYSE);
		await weigh(AYSE, '2026-06-01', 100);
		await weigh(AYSE, '2026-08-01', 97.5);
		await weigh(AYSE, '2026-10-30', 95.9);
		expect(keys(await progress.sync(AYSE, TODAY, ZONE))).toEqual(['weight:2', 'weight:4 (new)']);
		// Syncing again changes nothing; once marked seen, it stays seen.
		expect(keys(await progress.sync(AYSE, TODAY, ZONE))).toEqual(['weight:2', 'weight:4 (new)']);
		await progress.markSeen(AYSE, ['weight:4']);
		expect(keys(await progress.sync(AYSE, TODAY, ZONE))).toEqual(['weight:2', 'weight:4']);
	});

	it('withdraw an award when the weigh-in behind it is deleted, and move a date that changed', async () => {
		await adult(AYSE);
		await weigh(AYSE, '2026-06-01', 100);
		const typo = await weigh(AYSE, '2026-09-01', 9.8);
		expect(await progress.sync(AYSE, TODAY, ZONE)).toHaveLength(46); // 45 weight marks and the goal
		await admin`update weight_entries set deleted_at = now() where id = ${typo}`;
		await weigh(AYSE, '2026-09-10', 97.9);
		expect(await progress.sync(AYSE, TODAY, ZONE)).toMatchObject([
			{ kind: 'weight', level: 2, date: '2026-09-10' }
		]);
		// A backfilled earlier weigh-in moves the date; it was already seen and stays so.
		await weigh(AYSE, '2026-08-01', 97.6);
		expect(await progress.sync(AYSE, TODAY, ZONE)).toEqual([
			{ kind: 'weight', level: 2, date: '2026-08-01', seen: true }
		]);
	});

	it('leave weight out for a minor, in pregnancy, or without a goal below the start', async () => {
		await adult(AYSE, 120);
		await weigh(AYSE, '2026-06-01', 100);
		await weigh(AYSE, '2026-09-01', 90);
		expect(await service.sync(AYSE, TODAY, ZONE)).toEqual({ list: [], weightAllowed: false });
		await admin`update goal_versions set goal_weight_kg = 80 where user_id = ${AYSE}`;
		expect(await progress.sync(AYSE, TODAY, ZONE)).toHaveLength(5);
		await admin`update profiles set pregnant = true where user_id = ${AYSE}`;
		expect(await progress.sync(AYSE, TODAY, ZONE)).toEqual([]);
		await admin`update profiles set pregnant = false, birth_date = '2010-01-01' where user_id = ${AYSE}`;
		expect(await progress.sync(AYSE, TODAY, ZONE)).toEqual([]);
	});

	it('count streaks and firsts, in the person’s own day, and keep a recorded first voice log', async () => {
		await admin`insert into day_completions (user_id, local_date)
			select ${AYSE}, d::date from generate_series('2026-10-20'::date, '2026-10-26'::date, '1 day') d`;
		// Saved at 23:30 in Istanbul on 1 October, still 30 September in UTC.
		await admin`insert into foods (owner_id, visibility, name, search_key, basis, origin, created_at)
			values (${AYSE}, 'private', 'Etiket', 'etiket', '100g', 'label_scan', '2026-10-01T20:30:00Z')`;
		await progress.recordFirst(AYSE, 'voice', '2026-10-15');
		await progress.recordFirst(AYSE, 'voice', '2026-10-16'); // once only
		expect(await progress.sync(AYSE, TODAY, ZONE)).toEqual([
			{ kind: 'first', level: 'scan', date: '2026-10-01', seen: true },
			{ kind: 'first', level: 'voice', date: '2026-10-15', seen: false },
			{ kind: 'streak', level: 7, date: '2026-10-26', seen: true }
		]);
	});

	it('are private to their person', async () => {
		await adult(MEHMET);
		await weigh(MEHMET, '2026-06-01', 100);
		await weigh(MEHMET, '2026-10-30', 97);
		await progress.sync(MEHMET, TODAY, ZONE);
		// Ayşe's sync and seen marks never reach Mehmet's rows.
		expect(await progress.sync(AYSE, TODAY, ZONE)).toEqual([]);
		await progress.markSeen(AYSE, ['weight:2']);
		expect(keys(await progress.sync(MEHMET, TODAY, ZONE))).toEqual(['weight:2 (new)']);
		expect(await asUser(AYSE, (tx) => tx`select * from achievements`)).toHaveLength(0);
		const insert = asUser(
			AYSE,
			(tx) => tx`insert into achievements (user_id, kind, level, achieved_on)
				values (${MEHMET}, 'first', 'voice', '2026-10-01')`
		);
		await expect(insert).rejects.toThrow(/row-level security/);
		const update = await asUser(
			AYSE,
			(tx) => tx`update achievements set seen_at = now() where user_id = ${MEHMET} returning 1`
		);
		expect(update).toHaveLength(0);
		// Without an identity nothing is visible.
		expect(await appSql`select * from achievements`).toHaveLength(0);
	});
});
