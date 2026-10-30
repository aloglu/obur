// Saved meals against real PostgreSQL, run as the runtime role.
import { randomUUID } from 'node:crypto';
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as v from 'valibot';
import { afterAll, beforeEach, describe, expect, inject, it } from 'vitest';
import { FoodInput } from '../../../shared/food-input.ts';
import { createCatalog } from '../catalog/index.ts';
import { createSavedMeals } from './saved-meals.ts';
import { createDiary, DiaryError, resolveUnit } from './service.ts';

const urls = inject('db');
const quiet = { onnotice: () => {} };
const admin = postgres(urls.admin, { max: 1, ...quiet });
const appSql = postgres(urls.app, { max: 2, ...quiet });
const db = drizzle(appSql);
const catalog = createCatalog(db);
const diary = createDiary(db);
const saved = createSavedMeals(db);

const MEHMET = randomUUID();
const ZEYNEP = randomUUID();
const at = { localDate: '2026-10-25', meal: 'breakfast' as const, zone: 'Europe/Istanbul' };

const bread = (kcal = 193) =>
	v.parse(FoodInput, {
		name: 'Premium Light Ekmek',
		brand: 'Untad',
		visibility: 'shared',
		basis: '100g',
		nutrients: [{ code: 'energy_kcal', value: kcal, qualifier: 'reported' }],
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

/** Logs two slices of bread and a quick add, and saves them as "Kahvaltı". */
async function breakfast(userId = ZEYNEP) {
	const food = await catalog.getFood(userId, breadId);
	const slice = resolveUnit(
		{ kind: 'serving', servingId: food.servings[0].id },
		food.servings,
		[]
	)!;
	const a = await diary.logFood(userId, at, food, 2, slice);
	const b = await diary.quickAdd(userId, at, 120, 'Çay ve simit');
	return saved.createFromEntries(userId, { name: 'Kahvaltı', entryIds: [a.id, b.id] });
}

beforeEach(async () => {
	await admin`truncate users, foods, diary_entries cascade`;
	await admin`insert into users (id, display_name) values (${MEHMET}, 'Mehmet'), (${ZEYNEP}, 'Zeynep')`;
	breadId = await catalog.createFood(MEHMET, bread());
});

afterAll(async () => {
	await Promise.all([admin.end(), appSql.end()]);
});

describe('saving and logging', () => {
	it('saves entries with their snapshots and logs them as ordinary entries, keeping repeats', async () => {
		const meal = await breakfast();
		expect(meal).toMatchObject({ name: 'Kahvaltı', itemCount: 2, partial: false, revision: 1 });
		expect(meal.kcal).toBeCloseTo(193 * 0.52 + 120);
		expect(meal.items[0]).toMatchObject({ kind: 'food', foodId: breadId, amount: 2 });
		expect(meal.items[1]).toMatchObject({ kind: 'quick', description: 'Çay ve simit' });

		const picks = meal.items.map((i) => ({ itemId: i.id, entryId: randomUUID() }));
		const logged = await saved.log(ZEYNEP, meal.id, { ...at, localDate: '2026-10-26' }, picks);
		expect(logged.map((e) => e.kind)).toEqual(['food', 'quick']);
		expect(logged[0]).toMatchObject({ localDate: '2026-10-26', meal: 'breakfast', amount: 2 });
		// A retry returns the same entries; logging again with new IDs is a legitimate repeat.
		expect(await saved.log(ZEYNEP, meal.id, { ...at, localDate: '2026-10-26' }, picks)).toEqual(
			logged
		);
		await saved.log(ZEYNEP, meal.id, { ...at, localDate: '2026-10-26' }, [
			{ itemId: meal.items[0].id, entryId: randomUUID() }
		]);
		expect(await diary.day(ZEYNEP, '2026-10-26')).toHaveLength(3);

		// Logged entries are independent: editing one changes neither the meal nor other entries.
		await diary.update(ZEYNEP, logged[0].id, 1, { amount: 3 });
		expect((await saved.get(ZEYNEP, meal.id)).items[0].amount).toBe(2);
	});

	it('logs all or nothing', async () => {
		const meal = await breakfast();
		const taken = randomUUID();
		await diary.quickAdd(ZEYNEP, { ...at, id: taken }, 50, 'Other');
		const picks = [
			{ itemId: meal.items[0].id, entryId: randomUUID() },
			{ itemId: meal.items[1].id, entryId: taken }
		];
		expect(await errorCode(saved.log(ZEYNEP, meal.id, at, picks))).toBe('conflict');
		expect(
			await errorCode(
				saved.log(ZEYNEP, meal.id, at, [{ itemId: randomUUID(), entryId: randomUUID() }])
			)
		).toBe('not_found');
		expect(await diary.day(ZEYNEP, '2026-10-25')).toHaveLength(3);
	});

	it('keeps saved meals private and refuses other people’s entries', async () => {
		const meal = await breakfast();
		const mine = await diary.quickAdd(MEHMET, at, 300, 'Menemen');
		expect(await errorCode(saved.get(MEHMET, meal.id))).toBe('not_found');
		expect(await saved.list(MEHMET)).toEqual([]);
		expect(
			await errorCode(
				saved.log(MEHMET, meal.id, at, [{ itemId: meal.items[0].id, entryId: randomUUID() }])
			)
		).toBe('not_found');
		expect(await errorCode(saved.rename(MEHMET, meal.id, 1, 'Mine'))).toBe('not_found');
		expect(await errorCode(saved.remove(MEHMET, meal.id))).toBe('not_found');
		const zeynepsEntry = (await diary.day(ZEYNEP, '2026-10-25'))[0];
		expect(
			await errorCode(
				saved.createFromEntries(MEHMET, { name: 'X', entryIds: [mine.id, zeynepsEntry.id] })
			)
		).toBe('not_found');
		// Reusing someone else's meal ID is a conflict that reveals nothing.
		expect(
			await errorCode(
				saved.createFromEntries(MEHMET, { id: meal.id, name: 'X', entryIds: [mine.id] })
			)
		).toBe('conflict');

		// Directly in the database: no reads, no writes, no items under another person's meal.
		expect(await asUser(MEHMET, (tx) => tx`select id from saved_meals`)).toHaveLength(0);
		expect(await asUser(MEHMET, (tx) => tx`select id from saved_meal_items`)).toHaveLength(0);
		expect(
			await asUser(MEHMET, (tx) => tx`update saved_meals set name = 'X' returning id`)
		).toHaveLength(0);
		expect(
			await asUser(MEHMET, (tx) => tx`delete from saved_meal_items returning id`)
		).toHaveLength(0);
		expect(
			await errorCode(
				asUser(
					MEHMET,
					(
						tx
					) => tx`insert into saved_meal_items (id, saved_meal_id, user_id, position, kind, nutrients)
						values (${randomUUID()}, ${meal.id}, ${MEHMET}, 5, 'quick', '{"energy_kcal":{"value":1,"qualifier":"reported"}}')`
				)
			)
		).toBe('23503');
		expect(
			await errorCode(
				asUser(
					MEHMET,
					(
						tx
					) => tx`insert into saved_meal_items (id, saved_meal_id, user_id, position, kind, nutrients)
						values (${randomUUID()}, ${meal.id}, ${ZEYNEP}, 5, 'quick', '{"energy_kcal":{"value":1,"qualifier":"reported"}}')`
				)
			)
		).toBe('42501');
		expect((await saved.get(ZEYNEP, meal.id)).items).toHaveLength(2);
	});

	it('is idempotent by ID and refuses trashed entries', async () => {
		const meal = await breakfast();
		const again = await saved.createFromEntries(ZEYNEP, {
			id: meal.id,
			name: 'Kahvaltı',
			entryIds: [randomUUID()]
		});
		expect(again).toEqual(meal);
		expect(
			await errorCode(saved.createFromEntries(ZEYNEP, { id: meal.id, name: 'Other', entryIds: [] }))
		).toBe('not_found');
		const e = await diary.quickAdd(ZEYNEP, at, 80, 'Elma');
		await diary.remove(ZEYNEP, e.id);
		expect(
			await errorCode(saved.createFromEntries(ZEYNEP, { name: 'Elma', entryIds: [e.id] }))
		).toBe('not_found');
	});
});

describe('managing', () => {
	it('renames with revision checks and deletes without touching logged entries', async () => {
		const meal = await breakfast();
		const renamed = await saved.rename(ZEYNEP, meal.id, 1, 'Pazar kahvaltısı');
		expect(renamed).toMatchObject({ name: 'Pazar kahvaltısı', revision: 2 });
		expect(await errorCode(saved.rename(ZEYNEP, meal.id, 1, 'Stale'))).toBe('conflict');
		await saved.remove(ZEYNEP, meal.id);
		expect(await saved.list(ZEYNEP)).toEqual([]);
		expect(await diary.day(ZEYNEP, '2026-10-25')).toHaveLength(2);
		expect(await asUser(ZEYNEP, (tx) => tx`select id from saved_meal_items`)).toHaveLength(0);
	});

	it('refreshes only on request, by serving name after a food edit, and keeps what cannot be refreshed', async () => {
		const meal = await breakfast();
		await catalog.updateFood(MEHMET, breadId, 1, bread(250));
		// The catalog edit alone changes nothing.
		expect((await saved.get(ZEYNEP, meal.id)).kcal).toBeCloseTo(193 * 0.52 + 120);

		const foods = new Map((await catalog.foodsById(ZEYNEP, [breadId])).map((f) => [f.id, f]));
		const result = await saved.refresh(ZEYNEP, meal.id, 1, foods);
		expect(result).toMatchObject({ refreshed: 1, kept: 0 });
		expect(result.meal.kcal).toBeCloseTo(250 * 0.52 + 120);
		expect(result.meal.items[0].unit).toMatchObject({ kind: 'serving', name: 'slice', amount: 26 });
		expect(await errorCode(saved.refresh(ZEYNEP, meal.id, 1, foods))).toBe('conflict');

		// Without the food (gone or no longer visible), the item keeps its snapshot.
		const kept = await saved.refresh(ZEYNEP, meal.id, 2, new Map());
		expect(kept).toMatchObject({ refreshed: 0, kept: 1 });
		expect(kept.meal.kcal).toBeCloseTo(250 * 0.52 + 120);
	});

	it('lists meals with their item count and energy total', async () => {
		await breakfast();
		const [summary] = await saved.list(ZEYNEP);
		expect(summary).toMatchObject({ name: 'Kahvaltı', itemCount: 2, partial: false });
	});
});
