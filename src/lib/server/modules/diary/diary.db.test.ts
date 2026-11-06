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

describe('recently deleted', () => {
	it('lists what is in the trash, newest first, only one’s own and only for 30 days', async () => {
		const first = await diary.quickAdd(MEHMET, ctx(), 100, 'first');
		const second = await diary.quickAdd(MEHMET, ctx(), 200, 'second');
		const live = await diary.quickAdd(MEHMET, ctx(), 300, 'kept');
		await diary.remove(MEHMET, first.id);
		await diary.remove(MEHMET, second.id);

		expect((await diary.trash(MEHMET)).map((e) => e.description)).toEqual(['second', 'first']);
		expect((await diary.trash(MEHMET)).map((e) => e.id)).not.toContain(live.id);
		expect(await diary.trash(ZEYNEP)).toEqual([]);

		await admin`update diary_entries set deleted_at = now() - interval '31 days' where id = ${first.id}`;
		expect((await diary.trash(MEHMET)).map((e) => e.description)).toEqual(['second']);
	});
});

describe('day notes', () => {
	const DAY = '2026-10-25';
	const at = (time: string) => new Date(`2026-10-25T${time}:00Z`);

	it('starts empty, saves, and keeps the version typed last, whatever order they arrive in', async () => {
		expect(await diary.dayNote(MEHMET, DAY)).toEqual({ text: '', typedAt: null });
		await diary.saveDayNote(MEHMET, DAY, 'from the phone, typed later', at('12:00'));
		const stale = await diary.saveDayNote(MEHMET, DAY, 'from the laptop, sent late', at('11:00'));
		expect(stale.text).toBe('from the phone, typed later');
		expect((await diary.dayNote(MEHMET, DAY)).text).toBe('from the phone, typed later');
		await diary.saveDayNote(MEHMET, DAY, 'newer', at('12:30'));
		expect((await diary.dayNote(MEHMET, DAY)).text).toBe('newer');
	});

	it('an emptied note stays empty when an older edit arrives late', async () => {
		await diary.saveDayNote(MEHMET, DAY, 'something', at('10:00'));
		await diary.saveDayNote(MEHMET, DAY, '', at('11:00'));
		await diary.saveDayNote(MEHMET, DAY, 'something', at('10:30'));
		expect((await diary.dayNote(MEHMET, DAY)).text).toBe('');
	});

	it('a clock set ahead cannot block later edits', async () => {
		await diary.saveDayNote(
			MEHMET,
			DAY,
			'from the future',
			new Date(Date.now() + 86_400_000 * 365)
		);
		await diary.saveDayNote(MEHMET, DAY, 'typed now', new Date());
		expect((await diary.dayNote(MEHMET, DAY)).text).toBe('typed now');
	});

	it('is private: nobody else can read or change it, and it cannot be written for someone else', async () => {
		await diary.saveDayNote(MEHMET, DAY, 'private', at('10:00'));
		expect((await diary.dayNote(ZEYNEP, DAY)).text).toBe('');
		await diary.saveDayNote(ZEYNEP, DAY, 'her own', at('11:00'));
		expect((await diary.dayNote(MEHMET, DAY)).text).toBe('private');
		expect(
			await asUser(ZEYNEP, (tx) => tx`select 1 from day_notes where user_id = ${MEHMET}`)
		).toEqual([]);
		expect(
			await asUser(
				ZEYNEP,
				(tx) => tx`update day_notes set text = 'x' where user_id = ${MEHMET} returning 1`
			)
		).toHaveLength(0);
		await expect(
			asUser(
				ZEYNEP,
				(tx) =>
					tx`insert into day_notes (user_id, local_date, text, typed_at) values (${MEHMET}, '2026-10-26', 'x', now())`
			)
		).rejects.toThrow();
	});

	it('fails closed without an identity', async () => {
		await diary.saveDayNote(MEHMET, DAY, 'private', at('10:00'));
		const app = postgres(urls.app, { max: 1, ...quiet });
		try {
			await expect(app`select 1 from day_notes`).resolves.toHaveLength(0);
		} finally {
			await app.end();
		}
	});

	it('refuses an over-long note in the database', async () => {
		await expect(diary.saveDayNote(MEHMET, DAY, 'x'.repeat(10_001), at('10:00'))).rejects.toThrow();
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

it('sums energy per logged day, skipping deleted entries and unlogged days', async () => {
	await diary.quickAdd(MEHMET, ctx({ localDate: '2026-10-01' }), 300, null);
	await diary.quickAdd(MEHMET, ctx({ localDate: '2026-10-01' }), 450.4, null);
	const gone = await diary.quickAdd(MEHMET, ctx({ localDate: '2026-10-03' }), 999, null);
	await diary.remove(MEHMET, gone.id);
	await diary.quickAdd(ZEYNEP, ctx({ localDate: '2026-10-01' }), 5000, null);
	expect(await diary.dailyEnergy(MEHMET, '2026-10-01', '2026-10-31')).toEqual([
		{ localDate: '2026-10-01', kcal: 750 }
	]);
});

it('totals history days with each macro and the entries that leave it out, for the person only', async () => {
	const b = await catalog.getFood(MEHMET, breadId);
	await diary.logFood(MEHMET, ctx({ localDate: '2026-10-01' }), b, 200, grams);
	await diary.logFood(MEHMET, ctx({ localDate: '2026-10-01' }), b, 100, grams);
	// A calories-only quick add states no macros: the day's carbohydrate is then partial, not complete.
	await diary.quickAdd(MEHMET, ctx({ localDate: '2026-10-02' }), 100, null);
	await diary.logFood(MEHMET, ctx({ localDate: '2026-10-02' }), b, 100, grams);
	const gone = await diary.logFood(MEHMET, ctx({ localDate: '2026-10-05' }), b, 100, grams);
	await diary.remove(MEHMET, gone.id);
	await diary.quickAdd(ZEYNEP, ctx({ localDate: '2026-09-20' }), 5000, null);
	const rows = await diary.dailyHistory(MEHMET, '2026-10-01', '2026-10-31');
	expect(rows).toHaveLength(2);
	expect(rows[0]).toMatchObject({ localDate: '2026-10-01', kcal: 579 });
	expect(rows[0].carbohydrate.value).toBeCloseTo(127.2, 5);
	expect(rows[0].carbohydrate.missing).toBe(0);
	// The bread states no protein or fat: unknown on every entry, never zero.
	expect(rows[0].protein).toEqual({ value: 0, missing: 2 });
	expect(rows[1]).toMatchObject({ localDate: '2026-10-02', kcal: 293 });
	expect(rows[1].carbohydrate).toMatchObject({ missing: 1 });
	expect(rows[1].fat).toEqual({ value: 0, missing: 2 });
	expect(await diary.dailyHistory(ZEYNEP, '2026-10-01', '2026-10-31')).toEqual([]);
	expect(await diary.firstDay(MEHMET)).toBe('2026-10-01');
	expect(await diary.firstDay(ZEYNEP)).toBe('2026-09-20');
});

describe('bulk actions', () => {
	const at = (localDate: string, meal: 'breakfast' | 'lunch' | 'dinner' | 'snacks' = 'breakfast') =>
		ctx({ localDate, meal });

	it('moves several entries in one step, or none when one changed meanwhile', async () => {
		const b = await catalog.getFood(MEHMET, breadId);
		const a = await diary.logFood(MEHMET, at('2026-10-20'), b, 50, grams);
		const q = await diary.quickAdd(MEHMET, at('2026-10-20'), 300, 'Simit');
		const moved = await diary.bulk(MEHMET, {
			action: 'place',
			entries: [a, q].map((e) => ({
				id: e.id,
				revision: e.revision,
				date: '2026-10-21',
				meal: 'dinner'
			}))
		});
		expect(moved.map((e) => [e.localDate, e.meal, e.revision])).toEqual([
			['2026-10-21', 'dinner', 2],
			['2026-10-21', 'dinner', 2]
		]);
		// One stale revision: nothing moves.
		const stale = [
			{ id: a.id, revision: 2, date: '2026-10-20', meal: 'lunch' as const },
			{ id: q.id, revision: 1, date: '2026-10-20', meal: 'lunch' as const }
		];
		expect(await errorCode(diary.bulk(MEHMET, { action: 'place', entries: stale }))).toBe(
			'conflict'
		);
		expect((await diary.get(MEHMET, a.id)).meal).toBe('dinner');
		// Undo is a place back to where each was.
		const back = await diary.bulk(MEHMET, {
			action: 'place',
			entries: [
				{ id: a.id, revision: 2, date: '2026-10-20', meal: 'breakfast' },
				{ id: q.id, revision: 2, date: '2026-10-20', meal: 'breakfast' }
			]
		});
		expect(back.every((e) => e.localDate === '2026-10-20' && e.meal === 'breakfast')).toBe(true);
	});

	it("copies from the entries' own snapshots, once per copy ID, keeping legitimate repeats", async () => {
		const b = await catalog.getFood(MEHMET, breadId);
		const a = await diary.logFood(MEHMET, at('2026-10-20'), b, 100, grams);
		// The food changes after logging; a copy keeps what was logged.
		await catalog.updateFood(MEHMET, breadId, 1, {
			...bread(),
			nutrients: [{ code: 'energy_kcal', value: 999, qualifier: 'reported' }]
		});
		const copy = (copyId: string) =>
			diary.bulk(MEHMET, {
				action: 'copy',
				entries: [{ id: a.id, copyId }],
				date: '2026-10-21',
				meal: 'lunch',
				zone: 'Europe/Istanbul'
			});
		const first = randomUUID();
		const [c] = await copy(first);
		expect(c).toMatchObject({ id: first, localDate: '2026-10-21', meal: 'lunch', amount: 100 });
		expect(c.nutrients.energy_kcal?.value).toBe(a.nutrients.energy_kcal?.value);
		await copy(first); // a retry
		await copy(randomUUID()); // a second, deliberate copy
		expect(await diary.day(MEHMET, '2026-10-21')).toHaveLength(2);
		expect(await diary.day(MEHMET, '2026-10-20')).toHaveLength(1);
	});

	it('deletes to the trash and restores, all at once', async () => {
		const q1 = await diary.quickAdd(MEHMET, at('2026-10-20'), 100, null);
		const q2 = await diary.quickAdd(MEHMET, at('2026-10-20'), 200, null);
		await diary.bulk(MEHMET, { action: 'delete', ids: [q1.id, q2.id] });
		expect(await diary.day(MEHMET, '2026-10-20')).toHaveLength(0);
		await diary.bulk(MEHMET, { action: 'restore', ids: [q1.id, q2.id] });
		expect(await diary.day(MEHMET, '2026-10-20')).toHaveLength(2);
	});

	it("refuses the whole action when any entry is someone else's, missing or repeated", async () => {
		const mine = await diary.quickAdd(MEHMET, at('2026-10-20'), 100, null);
		const theirs = await diary.quickAdd(ZEYNEP, at('2026-10-20'), 500, null);
		expect(
			await errorCode(diary.bulk(MEHMET, { action: 'delete', ids: [mine.id, theirs.id] }))
		).toBe('not_found');
		expect(
			await errorCode(
				diary.bulk(MEHMET, {
					action: 'copy',
					entries: [{ id: theirs.id, copyId: randomUUID() }],
					date: '2026-10-21',
					meal: 'lunch',
					zone: 'Europe/Istanbul'
				})
			)
		).toBe('not_found');
		expect(await errorCode(diary.bulk(MEHMET, { action: 'delete', ids: [mine.id, mine.id] }))).toBe(
			'conflict'
		);
		// Nothing changed for either person.
		expect(await diary.day(MEHMET, '2026-10-20')).toHaveLength(1);
		expect(await diary.day(ZEYNEP, '2026-10-20')).toHaveLength(1);
		expect(await diary.day(MEHMET, '2026-10-21')).toHaveLength(0);
	});
});
