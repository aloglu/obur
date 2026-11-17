// The update that made foods private (drizzle/0055_private_foods.sql, 0056): seeded at the schema before it, then
// upgraded, against real PostgreSQL. Each member who used someone else's food gets their own copy, their records
// point at it, and nothing in anyone's diary changes.
import { randomUUID } from 'node:crypto';
import path from 'node:path';
import postgres from 'postgres';
import { afterAll, beforeAll, describe, expect, inject, it } from 'vitest';
import { bootstrapDatabase, passwordFromUrl } from '../../db/bootstrap.ts';
import { loadMigrations, migrate } from '../../db/migrator.ts';

const urls = inject('db');
const scratch = `${urls.database}_private_foods`;
const at = (url: string) => Object.assign(new URL(url), { pathname: `/${scratch}` }).toString();
const server = postgres(urls.admin, { max: 1, onnotice: () => {} });
let migrator: postgres.Sql;
let app: postgres.Sql;

const AYSE = randomUUID(); // makes and shares foods
const MEHMET = randomUUID(); // logs, saves and cooks with them
const GONE = randomUUID(); // shared a food, then deleted the account
const ids = {
	ayran: randomUUID(),
	ayranCup: randomUUID(),
	soup: randomUUID(),
	gonesBread: randomUUID(),
	ayseOwnUse: randomUUID(),
	unused: randomUUID(),
	curated: randomUUID(),
	variant: randomUUID(),
	ownVariant: randomUUID(),
	recipe: randomUUID(),
	meal: randomUUID()
};
const snapshot = (name: string) => ({
	name,
	brand: null,
	basis: '100g',
	servingLabel: null,
	servingSize: null,
	servings: [],
	basisNutrients: [{ code: 'energy_kcal', value: 38, qualifier: 'reported' }]
});
const kcal = (value: number) => ({ energy_kcal: { value, qualifier: 'reported' } });

async function food(tx: postgres.Sql, id: string, owner: string | null, name: string, extra = {}) {
	const row = {
		id,
		owner_id: owner,
		visibility: owner === AYSE && name === 'Ayşe’s own' ? 'private' : 'shared',
		name,
		search_key: name.toLowerCase(),
		basis: '100g',
		origin: 'manual',
		...extra
	};
	await tx`insert into foods ${tx(row)}`;
	await tx`insert into food_nutrients (food_id, code, value, qualifier) values (${id}, 'energy_kcal', 38, 'reported')`;
}

async function entry(
	tx: postgres.Sql,
	user: string,
	foodId: string,
	name: string,
	deleted = false
) {
	await tx`insert into diary_entries ${tx({
		id: randomUUID(),
		user_id: user,
		local_date: '2026-11-01',
		meal: 'lunch',
		zone: 'Europe/Istanbul',
		kind: 'food',
		food_id: foodId,
		food: tx.json(snapshot(name)),
		amount: 200,
		unit: tx.json({
			kind: 'serving',
			servingId: ids.ayranCup,
			name: 'cup',
			amount: 200,
			unit: 'ml'
		}),
		nutrients: tx.json(kcal(76)),
		deleted_at: deleted ? new Date() : null
	})}`;
}

beforeAll(async () => {
	await server.unsafe(`drop database if exists ${scratch} with (force)`);
	await server.unsafe(`create database ${scratch}`);
	const admin = postgres(at(urls.admin), { max: 1, onnotice: () => {} });
	await bootstrapDatabase(admin, scratch, {
		migrator: passwordFromUrl(urls.migrator),
		app: passwordFromUrl(urls.app),
		worker: passwordFromUrl(urls.worker)
	});
	await admin.end();
	migrator = postgres(at(urls.migrator), { max: 1, onnotice: () => {} });
	app = postgres(at(urls.app), { max: 1, onnotice: () => {} });

	const all = await loadMigrations(path.resolve(import.meta.dirname, '../../../../../drizzle'));
	const before = all.findIndex((m) => m.name === '0055_private_foods');
	await migrate(migrator, all.slice(0, before));

	// The schema as it was: shared foods, and the records that used them.
	await migrator`insert into users (id, display_name, role) values
		(${AYSE}, 'Ayşe', 'admin'), (${MEHMET}, 'Mehmet', 'member'), (${GONE}, 'Gone', 'member')`;
	await food(migrator, ids.ayran, AYSE, 'Ayran');
	await migrator`insert into food_servings (id, food_id, name, amount, unit, source)
		values (${ids.ayranCup}, ${ids.ayran}, 'cup', 200, 'ml', 'user')`;
	await food(migrator, ids.soup, AYSE, 'Soup', {
		origin: 'recipe',
		basis: 'serving',
		serving_label: 'serving'
	});
	await food(migrator, ids.gonesBread, GONE, 'Gone’s bread');
	await food(migrator, ids.ayseOwnUse, AYSE, 'Ayşe’s own');
	await food(migrator, ids.unused, AYSE, 'Nobody else used it');
	await food(migrator, ids.curated, null, 'Banana', {
		origin: 'curated',
		source_meta: migrator.json({ dataset: 'sr_legacy', fdcId: '173944' })
	});
	await food(migrator, ids.variant, MEHMET, 'Mehmet’s ayran', {
		visibility: 'private',
		origin: 'variant',
		derived_from: ids.ayran
	});
	// A copy Ayşe made of her own food (the variant row offered it then), pointing at it.
	await food(migrator, ids.ownVariant, AYSE, 'Ayşe’s own', {
		visibility: 'private',
		origin: 'variant',
		derived_from: ids.unused
	});
	// Mehmet's recipe with Ayşe's ayran in it.
	await food(migrator, ids.recipe, MEHMET, 'Ayranlı çorba', {
		visibility: 'private',
		origin: 'recipe',
		basis: 'serving',
		serving_label: 'serving'
	});
	await migrator`insert into recipes (food_id, owner_id, servings) values (${ids.recipe}, ${MEHMET}, 2)`;
	await migrator`insert into recipe_ingredients ${migrator({
		recipe_id: ids.recipe,
		owner_id: MEHMET,
		position: 0,
		food_id: ids.ayran,
		food: migrator.json(snapshot('Ayran')),
		amount: 200,
		unit: migrator.json({ kind: 'volume', unit: 'ml' }),
		nutrients: migrator.json(kcal(76))
	})}`;
	await entry(migrator, MEHMET, ids.ayran, 'Ayran');
	await entry(migrator, MEHMET, ids.ayran, 'Ayran', true); // in the trash
	await entry(migrator, MEHMET, ids.soup, 'Soup');
	await entry(migrator, MEHMET, ids.curated, 'Banana');
	await entry(migrator, AYSE, ids.ayran, 'Ayran');
	await migrator`insert into saved_meals (id, user_id, name) values (${ids.meal}, ${MEHMET}, 'Lunch')`;
	await migrator`insert into saved_meal_items ${migrator({
		id: randomUUID(),
		saved_meal_id: ids.meal,
		user_id: MEHMET,
		position: 0,
		kind: 'food',
		food_id: ids.gonesBread,
		food: migrator.json(snapshot('Gone’s bread')),
		amount: 50,
		unit: migrator.json({ kind: 'mass', unit: 'g' }),
		nutrients: migrator.json(kcal(19))
	})}`;
	await migrator`insert into import_identities (user_id, source_install, kind, source_id, local_id)
		values (${MEHMET}, ${randomUUID()}, 'food', 'archive-food', ${ids.ayran})`;
	// Gone deleted the account and kept the shared bread for others, as the old choice allowed.
	await migrator`delete from foods where owner_id = ${GONE} and visibility = 'private'`;
	await migrator`delete from users where id = ${GONE}`;

	await migrate(migrator, all);
});

afterAll(async () => {
	await Promise.all([migrator?.end(), app?.end()]);
	await server.unsafe(`drop database if exists ${scratch} with (force)`);
	await server.end();
});

const asUser = <T>(userId: string, run: (tx: postgres.TransactionSql) => Promise<T>) =>
	app.begin(async (tx) => {
		await tx`select set_config('app.user_id', ${userId}, true)`;
		return run(tx);
	}) as Promise<T>;

describe('foods become private', () => {
	it('gives Mehmet his own copy of each food he used that was someone else’s, once', async () => {
		const mine = await migrator`select id, name, origin, derived_from, archived_at from foods
			where owner_id = ${MEHMET} order by name`;
		expect(mine.map((f) => [f.name, f.origin])).toEqual([
			['Ayran', 'variant'],
			['Ayranlı çorba', 'recipe'],
			['Gone’s bread', 'variant'],
			['Mehmet’s ayran', 'variant'],
			['Soup', 'variant']
		]);
		// His older variant no longer points at Ayşe's food.
		expect(mine.find((f) => f.name === 'Mehmet’s ayran')?.derived_from).toBeNull();
		const copy = mine.find((f) => f.name === 'Ayran')!;
		const [n] = await migrator`select value from food_nutrients where food_id = ${copy.id}`;
		expect(Number(n.value)).toBe(38);
		const portions =
			await migrator`select name, amount from food_servings where food_id = ${copy.id}`;
		expect(portions.map((p) => [p.name, Number(p.amount)])).toEqual([['cup', 200]]);
		// A recipe becomes a plain food with its totals: no ingredients come with it.
		const soup = mine.find((f) => f.name === 'Soup')!;
		expect(await migrator`select 1 from recipes where food_id = ${soup.id}`).toHaveLength(0);
	});

	it('points his diary (trash too), saved meal and import record at his copies, without changing them', async () => {
		const copies = new Map(
			(await migrator`select id, name from foods where owner_id = ${MEHMET}`).map((f) => [
				f.name,
				f.id
			])
		);
		const entries =
			await migrator`select food_id, food->>'name' as name, energy_kcal, unit->>'servingId' as serving
			from diary_entries where user_id = ${MEHMET} order by name`;
		expect(entries.map((e) => [e.name, e.food_id])).toEqual([
			['Ayran', copies.get('Ayran')],
			['Ayran', copies.get('Ayran')],
			['Banana', ids.curated],
			['Soup', copies.get('Soup')]
		]);
		// The entry itself is untouched: its values and the portion it was logged in.
		expect(entries.every((e) => Number(e.energy_kcal) === 76 && e.serving === ids.ayranCup)).toBe(
			true
		);
		const [item] = await migrator`select food_id from saved_meal_items where user_id = ${MEHMET}`;
		expect(item.food_id).toBe(copies.get('Gone’s bread'));
		const [ingredient] =
			await migrator`select food_id from recipe_ingredients where owner_id = ${MEHMET}`;
		expect(ingredient.food_id).toBe(copies.get('Ayran'));
		const [identity] =
			await migrator`select local_id from import_identities where user_id = ${MEHMET}`;
		expect(identity.local_id).toBe(copies.get('Ayran'));
	});

	it('leaves Ayşe her foods and her own entries, and removes foods nobody owns', async () => {
		const hers = await migrator`select name from foods where owner_id = ${AYSE} order by name`;
		expect(hers.map((f) => f.name)).toEqual([
			'Ayran',
			'Ayşe’s own',
			'Ayşe’s own',
			'Nobody else used it',
			'Soup'
		]);
		// A copy of her own food no longer claims to be a variant (0057): only built-in sources are kept.
		const [copy] = await migrator`select derived_from from foods where id = ${ids.ownVariant}`;
		expect(copy.derived_from).toBeNull();
		const [own] = await migrator`select food_id from diary_entries where user_id = ${AYSE}`;
		expect(own.food_id).toBe(ids.ayran);
		expect(await migrator`select 1 from foods where id = ${ids.gonesBread}`).toHaveLength(0);
		expect(
			await migrator`select 1 from foods where owner_id is null and origin <> 'curated'`
		).toHaveLength(0);
	});

	it('shows each person only their own foods and the built-in ones', async () => {
		const seen = async (userId: string) =>
			(await asUser(userId, (tx) => tx`select name from foods order by name`)).map((f) => f.name);
		expect(await seen(MEHMET)).toEqual([
			'Ayran',
			'Ayranlı çorba',
			'Banana',
			'Gone’s bread',
			'Mehmet’s ayran',
			'Soup'
		]);
		expect(await seen(AYSE)).toEqual([
			'Ayran',
			'Ayşe’s own',
			'Ayşe’s own',
			'Banana',
			'Nobody else used it',
			'Soup'
		]);
		// Ayşe, an admin, can no longer change Mehmet's copy.
		const [copy] =
			await migrator`select id from foods where owner_id = ${MEHMET} and name = 'Ayran'`;
		const changed = await asUser(
			AYSE,
			(tx) => tx`update foods set name = 'X' where id = ${copy.id} returning id`
		);
		expect(changed).toHaveLength(0);
	});

	it('drops the shared column and the deletion list’s shared flag', async () => {
		const columns = await migrator`select table_name, column_name from information_schema.columns
			where (table_name = 'foods' and column_name = 'visibility')
				or (table_name = 'account_deletions' and column_name = 'removed_shared_foods')`;
		expect(columns).toHaveLength(0);
	});
});
