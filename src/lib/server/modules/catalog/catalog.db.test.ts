// Catalog privacy, edit rights and search against real PostgreSQL, run as the runtime roles.
import { randomUUID } from 'node:crypto';
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as v from 'valibot';
import { afterAll, beforeEach, describe, expect, inject, it } from 'vitest';
import { FoodInput } from '../../../shared/food-input.ts';
import { foodSearchKey } from '../../../shared/search-text.ts';
import { CatalogError, createCatalog } from './service.ts';

const urls = inject('db');
const quiet = { onnotice: () => {} };
const admin = postgres(urls.admin, { max: 1, ...quiet });
const appSql = postgres(urls.app, { max: 2, ...quiet });
const workerSql = postgres(urls.worker, { max: 1, ...quiet });
const catalog = createCatalog(drizzle(appSql));

const ADMIN = randomUUID();
const MEHMET = randomUUID();
const ZEYNEP = randomUUID();

const food = (overrides: Record<string, unknown> = {}) =>
	v.parse(FoodInput, {
		name: 'Ayran',
		brand: 'Sütaş',
		basis: '100ml',
		nutrients: [
			{ code: 'energy_kcal', value: 36, qualifier: 'reported' },
			{ code: 'protein', value: 1.7, qualifier: 'reported' }
		],
		...overrides
	});

async function errorCode(promise: Promise<unknown>): Promise<string | undefined> {
	try {
		await promise;
	} catch (e) {
		if (e instanceof CatalogError) return e.code;
		const err = e as { code?: string; cause?: { code?: string } };
		return err.cause?.code ?? err.code;
	}
	return undefined;
}

/** A built-in (curated) food, as `obur migrate` loads them: no owner, readable by everyone. */
async function builtIn(name: string, kcal = 36): Promise<string> {
	const [{ id }] = await admin`insert into foods (name, search_key, basis, origin, source_meta)
		values (${name}, ${foodSearchKey(name, null)}, '100g', 'curated',
			${admin.json({ dataset: 'sr_legacy', fdcId: randomUUID() })}) returning id`;
	await admin`insert into food_nutrients (food_id, code, value, qualifier) values (${id}, 'energy_kcal', ${kcal}, 'reported')`;
	await admin`insert into food_servings (food_id, name, amount, unit, source) values (${id}, 'cup', 245, 'g', 'reference')`;
	return id;
}

/** Runs raw SQL as the app role under an identity, to probe RLS directly. */
const asUser = <T>(userId: string, run: (tx: postgres.TransactionSql) => Promise<T>) =>
	appSql.begin(async (tx) => {
		await tx`select set_config('app.user_id', ${userId}, true)`;
		return run(tx);
	}) as Promise<T>;

beforeEach(async () => {
	await admin`truncate users cascade`;
	await admin`truncate foods cascade`;
	await admin`insert into users (id, display_name, role) values
		(${ADMIN}, 'Admin', 'admin'), (${MEHMET}, 'Mehmet', 'member'), (${ZEYNEP}, 'Zeynep', 'member')`;
});

afterAll(async () => {
	await Promise.all([admin.end(), appSql.end(), workerSql.end()]);
});

describe('privacy', () => {
	it('keeps every food to its owner, even from the admin', async () => {
		const id = await catalog.createFood(MEHMET, food({ name: 'Ev yoğurdu', brand: null }));
		expect((await catalog.getFood(MEHMET, id)).mine).toBe(true);
		expect(await errorCode(catalog.getFood(ZEYNEP, id))).toBe('not_found');
		expect(await errorCode(catalog.getFood(ADMIN, id))).toBe('not_found');
		expect(await catalog.searchFoods(ZEYNEP, 'yogurt')).toEqual([]);
		expect(await catalog.searchFoods(ADMIN, 'ev yogurdu')).toEqual([]);
		expect(await catalog.foodsById(ZEYNEP, [id])).toEqual([]);
	});

	it('shows built-in foods to everyone and lets no one change them', async () => {
		const id = await builtIn('Yogurt, plain, whole milk');
		const seen = await catalog.getFood(ZEYNEP, id);
		expect(seen).toMatchObject({ mine: false, origin: 'curated' });
		expect((await catalog.searchFoods(MEHMET, 'yogurt plain')).map((r) => r.id)).toEqual([id]);
		for (const who of [ZEYNEP, ADMIN]) {
			expect(await errorCode(catalog.updateFood(who, id, 1, food({ name: 'Mine now' })))).toBe(
				'forbidden'
			);
			expect(await errorCode(catalog.setArchived(who, id, true))).toBe('forbidden');
			const changed = await asUser(
				who,
				(tx) => tx`update foods set name = 'X' where id = ${id} returning id`
			);
			expect(changed).toHaveLength(0);
			expect(
				await errorCode(
					asUser(
						who,
						(tx) => tx`insert into food_nutrients (food_id, code, value, qualifier)
						values (${id}, 'fat', 99, 'reported')`
					)
				)
			).toBe('42501');
		}
	});

	it('lets the worker read only under an identity, and write nothing', async () => {
		const id = await catalog.createFood(MEHMET, food());
		const read = (userId: string) =>
			workerSql.begin(async (tx) => {
				await tx`select set_config('app.user_id', ${userId}, true)`;
				return tx`select name from foods where id = ${id}`;
			});
		expect((await read(MEHMET)).map((r) => r.name)).toEqual(['Ayran']);
		expect(await read(ZEYNEP)).toHaveLength(0);
		const write = workerSql.begin(async (tx) => {
			await tx`select set_config('app.user_id', ${MEHMET}, true)`;
			await tx`update foods set name = 'X' where id = ${id}`;
		});
		expect(await errorCode(write)).toBe('42501');
	});

	it('refuses a food without an owner, or one owned by someone else', async () => {
		for (const owner of [null, ZEYNEP])
			expect(
				await errorCode(
					asUser(
						MEHMET,
						(tx) => tx`insert into foods (owner_id, name, search_key, basis, origin)
						values (${owner}, 'Fake', 'fake', '100g', 'manual')`
					)
				)
			).toBe('42501');
		// A built-in food has no owner, and nothing else may lack one.
		expect(
			await errorCode(
				admin`insert into foods (owner_id, name, search_key, basis, origin)
					values (${MEHMET}, 'Fake', 'fake', '100g', 'curated')`
			)
		).toBe('23514');
		expect(
			await errorCode(
				admin`insert into foods (name, search_key, basis, origin) values ('Fake', 'fake', '100g', 'manual')`
			)
		).toBe('23514');
	});
});

describe('icons', () => {
	it('keeps a chosen icon, changes it with an edit, and refuses unknown ones in the app and the database', async () => {
		const id = await catalog.createFood(MEHMET, food({ icon: '1F95B' }));
		expect((await catalog.getFood(MEHMET, id)).icon).toBe('1F95B');
		await catalog.updateFood(MEHMET, id, 1, food({ icon: null }));
		expect((await catalog.getFood(MEHMET, id)).icon).toBeNull();
		expect(() => food({ icon: 'NOT-AN-ICON' })).toThrow();
		expect(
			await errorCode(asUser(MEHMET, (tx) => tx`update foods set icon = 'x' where id = ${id}`))
		).toBe('23514');
		const [hit] = await catalog.searchFoods(MEHMET, 'ayran');
		expect(hit).toMatchObject({ id, icon: null });
	});
});

describe('edit rights', () => {
	it('lets only the owner edit or archive, not even an admin', async () => {
		const id = await catalog.createFood(MEHMET, food());
		for (const who of [ZEYNEP, ADMIN]) {
			expect(await errorCode(catalog.updateFood(who, id, 1, food({ name: 'Hacked' })))).toBe(
				'not_found'
			);
			expect(await errorCode(catalog.setArchived(who, id, true))).toBe('not_found');
		}
		expect(await catalog.updateFood(MEHMET, id, 1, food({ name: 'Ayran (ev)' }))).toBe(2);
	});

	it('rejects a stale edit instead of overwriting a newer one', async () => {
		const id = await catalog.createFood(MEHMET, food());
		await catalog.updateFood(MEHMET, id, 1, food({ name: 'First edit' }));
		expect(await errorCode(catalog.updateFood(MEHMET, id, 1, food({ name: 'Stale edit' })))).toBe(
			'conflict'
		);
		expect((await catalog.getFood(MEHMET, id)).name).toBe('First edit');
	});

	it('enforces edit rights in the database, not only in the service', async () => {
		const id = await catalog.createFood(MEHMET, food());
		const changed = await asUser(
			ZEYNEP,
			(tx) => tx`update foods set name = 'X' where id = ${id} returning id`
		);
		expect(changed).toHaveLength(0);
		expect(
			await errorCode(
				asUser(MEHMET, (tx) => tx`update foods set owner_id = ${ZEYNEP} where id = ${id}`)
			)
		).toBe('42501');
		expect(
			await errorCode(
				asUser(
					ZEYNEP,
					(tx) => tx`insert into food_nutrients (food_id, code, value, qualifier)
					values (${id}, 'fat', 99, 'reported')`
				)
			)
		).toBe('42501');
		expect(
			await errorCode(
				asUser(
					ZEYNEP,
					(tx) => tx`insert into foods (owner_id, name, search_key, basis, origin)
					values (${MEHMET}, 'Fake', 'fake', '100g', 'manual')`
				)
			)
		).toBe('42501');
		expect(await errorCode(asUser(MEHMET, (tx) => tx`delete from foods where id = ${id}`))).toBe(
			'42501'
		);
	});
});

describe('nutrient contract', () => {
	it('stores derived values with their qualifier and never invents unknown ones', async () => {
		const id = await catalog.createFood(
			MEHMET,
			food({
				basis: '100g',
				nutrients: [
					{ code: 'energy_kj', value: 1098, qualifier: 'reported' },
					{ code: 'sodium', value: 480, qualifier: 'reported' },
					{ code: 'sugars', value: 0.5, qualifier: 'less_than' }
				]
			})
		);
		const { nutrients } = await catalog.getFood(MEHMET, id);
		expect(nutrients).toEqual(
			expect.arrayContaining([
				{ code: 'energy_kcal', value: 262.4283, qualifier: 'derived' },
				{ code: 'salt', value: 1.2, qualifier: 'derived' },
				{ code: 'sugars', value: 0.5, qualifier: 'less_than' }
			])
		);
		expect(nutrients.some((n) => n.code === 'fat')).toBe(false);
	});

	it('requires energy for hand-made foods', async () => {
		expect(
			await errorCode(
				catalog.createFood(
					MEHMET,
					food({ nutrients: [{ code: 'protein', value: 3, qualifier: 'reported' }] })
				)
			)
		).toBe('energy_required');
	});

	it('enforces basis and value constraints in the database', async () => {
		const bad = (sql: string) =>
			errorCode(asUser(MEHMET, (tx) => tx.unsafe(sql.replace('$owner', MEHMET))));
		expect(
			await bad(`insert into foods (owner_id, name, search_key, basis, origin)
				values ('$owner', 'Slice', 'slice', 'serving', 'manual')`)
		).toBe('23514');
		const id = await catalog.createFood(MEHMET, food());
		expect(await bad(`insert into food_nutrients values ('${id}', 'fat', -1, 'reported')`)).toBe(
			'23514'
		);
		expect(await bad(`insert into food_nutrients values ('${id}', 'fat', 1, 'guess')`)).toBe(
			'23514'
		);
		expect(
			await bad(`insert into food_nutrients values ('${id}', 'unobtainium', 1, 'reported')`)
		).toBe('23514');
	});

	it('keeps portions and a per-serving size', async () => {
		const id = await catalog.createFood(
			MEHMET,
			food({
				name: 'Protein Bar',
				brand: 'Delly',
				basis: 'serving',
				servingLabel: '1 bar',
				servingSize: { amount: 40, unit: 'g' },
				servings: [{ name: 'half bar', amount: 20, unit: 'g' }]
			})
		);
		const detail = await catalog.getFood(MEHMET, id);
		expect(detail).toMatchObject({
			basis: 'serving',
			servingLabel: '1 bar',
			servingSize: { amount: 40, unit: 'g' },
			servings: [{ name: 'half bar', amount: 20, unit: 'g' }]
		});
	});
});

describe('variants and archiving', () => {
	it('makes a private variant of a built-in food that records its source', async () => {
		const id = await builtIn('Bread, white');
		const variant = await catalog.makeVariant(ZEYNEP, id);
		const detail = await catalog.getFood(ZEYNEP, variant);
		expect(detail).toMatchObject({ mine: true, derivedFrom: id, origin: 'variant' });
		expect(detail.nutrients).toEqual((await catalog.getFood(ZEYNEP, id)).nutrients);
		expect(detail.servings.map((s) => s.name)).toEqual(['cup']);
		expect(await errorCode(catalog.getFood(MEHMET, variant))).toBe('not_found');
	});

	it('refuses a variant of the person’s own food (a regression: each tap made another copy)', async () => {
		const own = await catalog.createFood(MEHMET, food());
		expect(await errorCode(catalog.makeVariant(MEHMET, own))).toBe('forbidden');
		const variant = await catalog.makeVariant(MEHMET, await builtIn('Bread, white'));
		expect(await errorCode(catalog.makeVariant(MEHMET, variant))).toBe('forbidden');
		expect((await catalog.ownFoods(MEHMET)).total).toBe(2);
	});

	it('hides archived foods from search and lets the owner restore them', async () => {
		const id = await catalog.createFood(MEHMET, food());
		await catalog.setArchived(MEHMET, id, true);
		expect(await catalog.searchFoods(MEHMET, 'ayran')).toEqual([]);
		expect((await catalog.getFood(MEHMET, id)).archived).toBe(true);
		await catalog.setArchived(MEHMET, id, false);
		expect(await catalog.searchFoods(MEHMET, 'ayran')).toHaveLength(1);
	});
});

describe('imported foods', () => {
	it('archives and brings back only the person’s own LoseIt foods, in one step', async () => {
		const imported = await catalog.createFood(MEHMET, food(), {
			origin: 'loseit'
		});
		const second = await catalog.createFood(MEHMET, food({ name: 'Second import' }), {
			origin: 'loseit'
		});
		const own = await catalog.createFood(MEHMET, food({ name: 'Own ayran' }));
		const theirs = await catalog.createFood(ZEYNEP, food({ name: 'Zeynep import' }), {
			origin: 'loseit'
		});
		expect(await catalog.importedFoods(MEHMET)).toEqual({ active: 2, archived: 0 });

		expect(await catalog.setImportedArchived(MEHMET, true)).toBe(2);
		expect((await catalog.getFood(MEHMET, imported)).archived).toBe(true);
		expect((await catalog.getFood(MEHMET, second)).archived).toBe(true);
		expect((await catalog.getFood(MEHMET, own)).archived).toBe(false);
		expect((await catalog.getFood(ZEYNEP, theirs)).archived).toBe(false);
		expect((await catalog.searchFoods(MEHMET, 'ayran')).map((f) => f.name)).toEqual(['Own ayran']);
		expect(await catalog.importedFoods(MEHMET)).toEqual({ active: 0, archived: 2 });
		// Repeating it changes nothing; another person's imports are theirs alone.
		expect(await catalog.setImportedArchived(MEHMET, true)).toBe(0);
		expect(await catalog.importedFoods(ZEYNEP)).toEqual({ active: 1, archived: 0 });

		expect(await catalog.setImportedArchived(MEHMET, false)).toBe(2);
		expect((await catalog.getFood(MEHMET, imported)).archived).toBe(false);
	});
});

describe('search', () => {
	beforeEach(async () => {
		await catalog.createFood(ZEYNEP, food());
		await catalog.createFood(
			ZEYNEP,
			food({ name: 'Körpe Ispanak', brand: 'Superfresh', basis: '100g' })
		);
		await catalog.createFood(
			ZEYNEP,
			food({ name: 'Mini Top Peynir', brand: 'İçim', basis: '100g' })
		);
	});

	it.each([
		['sutas', 'Ayran'],
		['SÜTAŞ AYRAN', 'Ayran'],
		['ayran sutas', 'Ayran'],
		['ispanak', 'Körpe Ispanak'],
		['ıspanak', 'Körpe Ispanak'],
		['icim', 'Mini Top Peynir'],
		['ayrann', 'Ayran']
	])('%s finds %s', async (query, name) => {
		const [first] = await catalog.searchFoods(ZEYNEP, query);
		expect(first?.name).toBe(name);
	});

	it('ranks the person’s own foods before built-in ones among real matches', async () => {
		const builtInAyran = await builtIn('Ayran', 40);
		const results = await catalog.searchFoods(ZEYNEP, 'ayran');
		expect(results.map((r) => [r.brand, r.mine])).toEqual([
			['Sütaş', true],
			[null, false]
		]);
		expect(results[1]).toMatchObject({ id: builtInAyran, kcal: 40, curated: true });
	});

	it('ranks boosted (recent) foods first among real matches', async () => {
		const [own] = (await catalog.searchFoods(ZEYNEP, 'sutas')).map((r) => r.id);
		const recent = await builtIn('Ayran', 40);
		const boosted = await catalog.searchFoods(ZEYNEP, 'ayran', 20, [recent]);
		expect(boosted.map((r) => r.id)).toEqual([recent, own]);
	});

	it('finds a food in words taken from a sentence, preferring real matches on fewer words', async () => {
		const names = async (text: string) =>
			(await catalog.searchFoodsLoose(ZEYNEP, text)).map((r) => r.name);
		expect(await names('Superfresh körpe ıspanak')).toEqual(['Körpe Ispanak']);
		// Extra words would only allow a typo match; the words that all match win instead.
		expect((await names('İçim mini top peynir after gym'))[0]).toBe('Mini Top Peynir');
		expect((await names('ayran with ice cubes'))[0]).toBe('Ayran');
		expect(await names('zzz qqq')).toEqual([]);
	});

	it('never proposes another person’s food', async () => {
		await catalog.createFood(MEHMET, food({ name: 'Gizli Börek', brand: null, basis: '100g' }));
		expect(await catalog.searchFoodsLoose(ZEYNEP, 'iki dilim gizli börek')).toEqual([]);
		expect((await catalog.searchFoodsLoose(MEHMET, 'iki dilim gizli börek'))[0]?.name).toBe(
			'Gizli Börek'
		);
	});

	it('returns nothing for an empty or punctuation-only query', async () => {
		expect(await catalog.searchFoods(ZEYNEP, '  ')).toEqual([]);
		expect(await catalog.searchFoods(ZEYNEP, '%_')).toEqual([]);
	});
});

it('provides the seeded household measures', async () => {
	const measures = await catalog.householdMeasures();
	expect(measures.map((m) => [m.name, m.ml])).toEqual([
		['Su bardağı', 200],
		['Çay bardağı', 100],
		['Yemek kaşığı', 15],
		['Tatlı kaşığı', 10],
		['Çay kaşığı', 5]
	]);
});

describe('label scan edit counts', () => {
	const edits = {
		proposed: 7,
		changed: 1,
		removed: 0,
		added: 2,
		basisKnown: true,
		basisChanged: false
	};

	it('are saved with a scanned food only, private to its owner', async () => {
		const scanned = await catalog.createFood(MEHMET, food(), {
			origin: 'label_scan',
			scanEdits: edits
		});
		// A hand-made food never records counts, even if some are sent.
		await catalog.createFood(MEHMET, food({ name: 'Elle' }), {
			origin: 'manual',
			scanEdits: edits
		});
		const own = await asUser(
			MEHMET,
			(tx) => tx`select food_id, changed, added from label_scan_edits`
		);
		expect(own).toEqual([{ food_id: scanned, changed: 1, added: 2 }]);
		// Not even an admin reads someone's rows.
		expect(await asUser(ZEYNEP, (tx) => tx`select 1 from label_scan_edits`)).toHaveLength(0);
		expect(await asUser(ADMIN, (tx) => tx`select 1 from label_scan_edits`)).toHaveLength(0);
	});

	it("can't be written for someone else, for someone else's food, or changed", async () => {
		const zeynepsScan = await catalog.createFood(ZEYNEP, food(), { origin: 'label_scan' });
		const insert = (owner: string, foodId: string) =>
			asUser(
				MEHMET,
				(tx) => tx`insert into label_scan_edits
				(food_id, owner_id, proposed, changed, removed, added, basis_known, basis_changed)
				values (${foodId}, ${owner}, 1, 0, 0, 0, true, false)`
			);
		expect(await errorCode(insert(ZEYNEP, zeynepsScan))).toBe('42501');
		expect(await errorCode(insert(MEHMET, zeynepsScan))).toBe('42501');
		const mine = await catalog.createFood(MEHMET, food(), {
			origin: 'label_scan',
			scanEdits: edits
		});
		expect(
			await errorCode(
				asUser(MEHMET, (tx) => tx`update label_scan_edits set changed = 0 where food_id = ${mine}`)
			)
		).toBe('42501');
	});

	it('refuse impossible counts, and go with the food', async () => {
		expect(
			await errorCode(
				catalog.createFood(MEHMET, food(), {
					origin: 'label_scan',
					scanEdits: { ...edits, proposed: 1, changed: 1, removed: 1 }
				})
			)
		).toBe('23514');
		// The failed save left no food behind.
		expect(
			await asUser(MEHMET, (tx) => tx`select 1 from foods where owner_id = ${MEHMET}`)
		).toHaveLength(0);
		const id = await catalog.createFood(MEHMET, food(), { origin: 'label_scan', scanEdits: edits });
		await admin`delete from foods where id = ${id}`;
		expect(await admin`select 1 from label_scan_edits`).toHaveLength(0);
	});

	it('are totalled for admins across all members, and only for admins', async () => {
		await catalog.createFood(MEHMET, food(), { origin: 'label_scan', scanEdits: edits });
		await catalog.createFood(ZEYNEP, food(), {
			origin: 'label_scan',
			scanEdits: { ...edits, changed: 0, added: 0, basisKnown: false }
		});
		expect(await catalog.labelScanTotals(ADMIN)).toEqual({
			scans: 2,
			withoutEdits: 1,
			proposed: 14,
			changed: 1,
			removed: 0,
			added: 2,
			basisUnknown: 1,
			basisChanged: 0
		});
		expect(await errorCode(catalog.labelScanTotals(MEHMET))).toBe('42501');
	});
});

describe('own foods', () => {
	it("lists only the person's foods, a page at a time, archived last and left out of the count", async () => {
		const names = ['Çörek', 'Ayran', 'Börek'];
		const ids = [];
		for (const name of names) ids.push(await catalog.createFood(MEHMET, food({ name })));
		await catalog.createFood(ZEYNEP, food({ name: 'Zeynep’s food' }));
		await catalog.setArchived(MEHMET, ids[1], true);

		const first = await catalog.ownFoods(MEHMET, 0, 1);
		expect(first.total).toBe(2);
		expect(first.more).toBe(true);
		expect(first.foods.map((f) => f.name)).toEqual(['Börek']);

		const rest = await catalog.ownFoods(MEHMET, 1, 50);
		expect(rest.more).toBe(false);
		expect(rest.foods.map((f) => [f.name, f.archived])).toEqual([
			['Çörek', false],
			['Ayran', true]
		]);
	});
});

describe('foodsById', () => {
	it('gives each visible food its own values and portions, the same as one at a time', async () => {
		const ayran = await catalog.createFood(
			MEHMET,
			food({
				servings: [
					{ name: 'Bottle', amount: 300, unit: 'ml', source: 'user' },
					{ name: 'Glass', amount: 200, unit: 'ml', source: 'user' }
				]
			})
		);
		const yogurt = await builtIn('Yogurt', 60);
		const hidden = await catalog.createFood(ZEYNEP, food({ name: 'Gizli' }));

		const found = await catalog.foodsById(MEHMET, [ayran, yogurt, hidden, randomUUID()]);

		expect(new Map(found.map((f) => [f.id, f]))).toEqual(
			new Map([
				[ayran, await catalog.getFood(MEHMET, ayran)],
				[yogurt, await catalog.getFood(MEHMET, yogurt)]
			])
		);
		const ayranFound = found.find((f) => f.id === ayran)!;
		expect(ayranFound.servings.map((s) => s.name)).toEqual(['Glass', 'Bottle']);
	});
});
