// Diary rules against real PostgreSQL, run as the runtime role.
import { randomUUID } from 'node:crypto';
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as v from 'valibot';
import { afterAll, beforeEach, describe, expect, inject, it } from 'vitest';
import { dayTotals } from '../../../shared/diary-rules.ts';
import { FoodInput } from '../../../shared/food-input.ts';
import { createCatalog } from '../catalog/index.ts';
import { createDiary, DiaryError, resolveUnit, type EntryContext } from './service.ts';

const urls = inject('db');
const quiet = { onnotice: () => {} };
const admin = postgres(urls.admin, { max: 1, ...quiet });
const appSql = postgres(urls.app, { max: 2, ...quiet });
const db = drizzle(appSql);
const catalog = createCatalog(db);
const diary = createDiary(db);

const MEHMET = randomUUID();
const ZEYNEP = randomUUID();
const ctx = (overrides: Partial<EntryContext> = {}): EntryContext => ({
	localDate: '2026-10-25',
	meal: 'lunch',
	zone: 'Europe/Istanbul',
	...overrides
});
const grams = { kind: 'mass', unit: 'g' } as const;

const bread = () =>
	v.parse(FoodInput, {
		name: 'Premium Light Ekmek',
		brand: 'Untad',
		visibility: 'shared',
		basis: '100g',
		nutrients: [
			{ code: 'energy_kcal', value: 193, qualifier: 'reported' },
			{ code: 'carbohydrate_excl_fibre', value: 42.4, qualifier: 'reported' }
		],
		servings: [{ name: 'slice', amount: 26, unit: 'g' }]
	});

async function errorCode(promise: Promise<unknown>): Promise<string | undefined> {
	try {
		await promise;
	} catch (e) {
		if (e instanceof DiaryError) return e.code;
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

let breadId: string;

beforeEach(async () => {
	await admin`truncate users, foods, diary_entries cascade`;
	await admin`insert into users (id, display_name) values (${MEHMET}, 'Mehmet'), (${ZEYNEP}, 'Zeynep')`;
	breadId = await catalog.createFood(MEHMET, bread());
});

afterAll(async () => {
	await Promise.all([admin.end(), appSql.end()]);
});

describe('snapshots', () => {
	it('keeps an entry’s nutrition when the food changes later', async () => {
		const food = await catalog.getFood(ZEYNEP, breadId);
		const entry = await diary.logFood(ZEYNEP, ctx(), food, 52, grams);
		expect(entry.nutrients.energy_kcal).toEqual({ value: 100.36, qualifier: 'reported' });

		await catalog.updateFood(MEHMET, breadId, 1, {
			...bread(),
			nutrients: [{ code: 'energy_kcal', value: 250, qualifier: 'reported' }]
		});
		const [stored] = await diary.day(ZEYNEP, '2026-10-25');
		expect(stored.nutrients.energy_kcal?.value).toBe(100.36);
		expect(stored.food?.basisNutrients).toContainEqual({
			code: 'energy_kcal',
			value: 193,
			qualifier: 'reported'
		});

		// Changing the amount re-scales from the entry's own snapshot, not the new catalog values.
		const edited = await diary.update(ZEYNEP, entry.id, 1, { amount: 104 });
		expect(edited.nutrients.energy_kcal?.value).toBe(200.72);
		expect(edited.nutrients.carbohydrate_excl_fibre?.value).toBeCloseTo(44.096);
	});

	it('logs by a stored portion and refuses conversions the food cannot support', async () => {
		const food = await catalog.getFood(ZEYNEP, breadId);
		const slice = resolveUnit(
			{ kind: 'serving', servingId: food.servings[0].id },
			food.servings,
			[]
		);
		const entry = await diary.logFood(ZEYNEP, ctx(), food, 3, slice!);
		expect(entry.nutrients.energy_kcal?.value).toBeCloseTo(150.54);

		const glass = resolveUnit({ kind: 'measure', code: 'su_bardagi' }, food.servings, [
			{ code: 'su_bardagi', name: 'Su bardağı', ml: 200 }
		]);
		expect(await errorCode(diary.logFood(ZEYNEP, ctx(), food, 1, glass!))).toBe(
			'conversion_unknown'
		);
		expect(
			resolveUnit({ kind: 'serving', servingId: randomUUID() }, food.servings, [])
		).toBeUndefined();
	});

	it('keeps the entry when its food disappears from the catalog', async () => {
		const food = await catalog.getFood(MEHMET, breadId);
		await diary.logFood(MEHMET, ctx(), food, 100, grams);
		await admin`delete from foods where id = ${breadId}`;
		const [entry] = await diary.day(MEHMET, '2026-10-25');
		expect(entry).toMatchObject({ foodId: null, food: { name: 'Premium Light Ekmek' } });
		expect(entry.nutrients.energy_kcal?.value).toBe(193);
	});
});

describe('quick adds and totals', () => {
	it('records only the stated calories and leaves the rest unknown', async () => {
		const food = await catalog.getFood(MEHMET, breadId);
		await diary.logFood(MEHMET, ctx(), food, 100, grams);
		const quick = await diary.quickAdd(MEHMET, ctx({ meal: 'snacks' }), 300, 'Simit');
		expect(quick.nutrients).toEqual({ energy_kcal: { value: 300, qualifier: 'reported' } });
		const totals = dayTotals(await diary.day(MEHMET, '2026-10-25'));
		expect(totals.energy_kcal).toEqual({ value: 493, unknown: 0, approximate: false });
		expect(totals.carbohydrate_excl_fibre).toEqual({ value: 42.4, unknown: 1, approximate: false });
		const [{ energy_kcal }] =
			await admin`select energy_kcal from diary_entries where id = ${quick.id}`;
		expect(Number(energy_kcal)).toBe(300);
	});

	it('edits a quick add’s calories and description', async () => {
		const quick = await diary.quickAdd(MEHMET, ctx(), 300, 'Simit');
		const edited = await diary.update(MEHMET, quick.id, 1, {
			kcal: 280,
			description: 'Simit (half)'
		});
		expect(edited).toMatchObject({ description: 'Simit (half)', revision: 2 });
		expect(edited.nutrients.energy_kcal?.value).toBe(280);
	});
});

describe('corrections', () => {
	it('moves an entry to another meal or day and rejects a stale edit', async () => {
		const quick = await diary.quickAdd(MEHMET, ctx(), 300, null);
		await diary.update(MEHMET, quick.id, 1, { meal: 'dinner', localDate: '2026-10-24' });
		expect(await diary.day(MEHMET, '2026-10-25')).toEqual([]);
		expect((await diary.day(MEHMET, '2026-10-24'))[0]).toMatchObject({
			meal: 'dinner',
			revision: 2
		});
		expect(await errorCode(diary.update(MEHMET, quick.id, 1, { meal: 'lunch' }))).toBe('conflict');
	});

	it('deletes to the trash, restores, and stops restoring after 30 days', async () => {
		const quick = await diary.quickAdd(MEHMET, ctx(), 300, null);
		await diary.remove(MEHMET, quick.id);
		expect(await diary.day(MEHMET, '2026-10-25')).toEqual([]);
		expect(await errorCode(diary.update(MEHMET, quick.id, 2, { kcal: 1 }))).toBe('not_found');
		await diary.restore(MEHMET, quick.id);
		expect(await diary.day(MEHMET, '2026-10-25')).toHaveLength(1);

		await diary.remove(MEHMET, quick.id);
		await admin`update diary_entries set deleted_at = now() - interval '31 days' where id = ${quick.id}`;
		expect(await errorCode(diary.restore(MEHMET, quick.id))).toBe('not_found');
	});
});

describe('retries', () => {
	it('returns the original entry for a repeated create with the same ID', async () => {
		const id = randomUUID();
		const first = await diary.quickAdd(MEHMET, ctx({ id }), 300, 'Simit');
		const again = await diary.quickAdd(MEHMET, ctx({ id }), 300, 'Simit');
		expect(again).toEqual(first);
		expect(await diary.day(MEHMET, '2026-10-25')).toHaveLength(1);
	});

	it('rejects the same ID reused with different content', async () => {
		const id = randomUUID();
		await diary.quickAdd(MEHMET, ctx({ id }), 300, 'Simit');
		expect(await errorCode(diary.quickAdd(MEHMET, ctx({ id }), 450, 'Simit'))).toBe('conflict');
	});

	it('gives a conflict, not a leak, when an ID belongs to someone else', async () => {
		const id = randomUUID();
		await diary.quickAdd(MEHMET, ctx({ id }), 300, 'Simit');
		expect(await errorCode(diary.quickAdd(ZEYNEP, ctx({ id }), 300, 'Simit'))).toBe('conflict');
	});
});

describe('isolation', () => {
	it('keeps diaries per person through the service', async () => {
		const quick = await diary.quickAdd(MEHMET, ctx(), 300, null);
		expect(await diary.day(ZEYNEP, '2026-10-25')).toEqual([]);
		expect(await errorCode(diary.update(ZEYNEP, quick.id, 1, { kcal: 1 }))).toBe('not_found');
		expect(await errorCode(diary.remove(ZEYNEP, quick.id))).toBe('not_found');
		expect(await diary.recentFoodIds(ZEYNEP)).toEqual([]);
	});

	it('enforces ownership in the database', async () => {
		const quick = await diary.quickAdd(MEHMET, ctx(), 300, null);
		const changed = await asUser(
			ZEYNEP,
			(tx) => tx`update diary_entries set meal = 'dinner' where id = ${quick.id} returning id`
		);
		expect(changed).toHaveLength(0);
		expect(
			await errorCode(
				asUser(
					ZEYNEP,
					(
						tx
					) => tx`insert into diary_entries (id, user_id, local_date, meal, zone, kind, nutrients)
					values (${randomUUID()}, ${MEHMET}, '2026-10-25', 'lunch', 'UTC', 'quick', '{"energy_kcal":{"value":1,"qualifier":"reported"}}')`
				)
			)
		).toBe('42501');
		expect(
			await errorCode(
				asUser(
					MEHMET,
					(tx) => tx`update diary_entries set user_id = ${ZEYNEP} where id = ${quick.id}`
				)
			)
		).toBe('42501');
		expect(
			await errorCode(asUser(MEHMET, (tx) => tx`delete from diary_entries where id = ${quick.id}`))
		).toBe('42501');
	});

	it('enforces entry shape in the database', async () => {
		const insert = (
			kind: string,
			extra: string,
			nutrients = `'{"energy_kcal":{"value":1,"qualifier":"reported"}}'`,
			zone = 'UTC'
		) =>
			errorCode(
				asUser(MEHMET, (tx) =>
					tx.unsafe(`insert into diary_entries (id, user_id, local_date, meal, zone, kind, nutrients ${extra ? ', food' : ''})
						values ('${randomUUID()}', '${MEHMET}', '2026-10-25', 'lunch', '${zone}', '${kind}', ${nutrients} ${extra})`)
				)
			);
		expect(await insert('quick', `, '{"name":"x"}'`)).toBe('23514');
		expect(await insert('food', '')).toBe('23514');
		expect(await insert('quick', '', `'[]'`)).toBe('23514');
		expect(await insert('quick', '', `'{}'`)).toBe('23514');
		expect(await insert('quick', '', undefined, 'Europe/Istanbul;drop')).toBe('23514');
	});
});

it('lists recent foods newest first', async () => {
	const ayranId = await catalog.createFood(MEHMET, {
		...bread(),
		name: 'Ayran',
		basis: '100ml',
		servings: []
	});
	const b = await catalog.getFood(MEHMET, breadId);
	const a = await catalog.getFood(MEHMET, ayranId);
	await diary.logFood(MEHMET, ctx(), b, 100, grams);
	await diary.logFood(MEHMET, ctx(), a, 200, { kind: 'volume', unit: 'ml' });
	expect(await diary.recentFoodIds(MEHMET)).toEqual([ayranId, breadId]);
});

it('marks days complete, idempotently and privately', async () => {
	await diary.setDayComplete(MEHMET, '2026-10-24', true);
	await diary.setDayComplete(MEHMET, '2026-10-24', true);
	await diary.setDayComplete(MEHMET, '2026-10-25', true);
	expect(await diary.completedDays(MEHMET, '2026-10-01', '2026-10-31')).toEqual([
		'2026-10-24',
		'2026-10-25'
	]);
	await diary.setDayComplete(MEHMET, '2026-10-25', false);
	expect(await diary.completedDays(MEHMET, '2026-10-01', '2026-10-31')).toEqual(['2026-10-24']);
	expect(await diary.completedDays(ZEYNEP, '2026-10-01', '2026-10-31')).toEqual([]);
});
