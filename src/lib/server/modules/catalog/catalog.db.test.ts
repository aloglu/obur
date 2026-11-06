// Catalog visibility, edit rights and search against real PostgreSQL, run as the runtime roles.
import { randomUUID } from 'node:crypto';
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as v from 'valibot';
import { afterAll, beforeEach, describe, expect, inject, it } from 'vitest';
import { FoodInput } from '../../../shared/food-input.ts';
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
		visibility: 'shared',
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

/** Runs raw SQL as the app role under an identity, to probe RLS directly. */
const asUser = <T>(userId: string, run: (tx: postgres.TransactionSql) => Promise<T>) =>
	appSql.begin(async (tx) => {
		await tx`select set_config('app.user_id', ${userId}, true)`;
		return run(tx);
	}) as Promise<T>;

beforeEach(async () => {
	await admin`truncate users, foods cascade`;
	await admin`insert into users (id, display_name, role) values
		(${ADMIN}, 'Admin', 'admin'), (${MEHMET}, 'Mehmet', 'member'), (${ZEYNEP}, 'Zeynep', 'member')`;
});

afterAll(async () => {
	await Promise.all([admin.end(), appSql.end(), workerSql.end()]);
});

describe('visibility', () => {
	it('keeps private foods private, even from the admin', async () => {
		const id = await catalog.createFood(
			MEHMET,
			food({ visibility: 'private', name: 'Ev yoğurdu', brand: null })
		);
		expect((await catalog.getFood(MEHMET, id)).mine).toBe(true);
		expect(await errorCode(catalog.getFood(ZEYNEP, id))).toBe('not_found');
		expect(await errorCode(catalog.getFood(ADMIN, id))).toBe('not_found');
		expect(await catalog.searchFoods(ZEYNEP, 'yogurt')).toEqual([]);
		expect(await catalog.searchFoods(ADMIN, 'ev yogurdu')).toEqual([]);
	});

	it('shows shared foods to everyone without revealing their creator', async () => {
		const id = await catalog.createFood(MEHMET, food());
		const seen = await catalog.getFood(ZEYNEP, id);
		expect(seen).toMatchObject({ name: 'Ayran', brand: 'Sütaş', mine: false, editable: false });
		expect(Object.keys(seen)).not.toContain('ownerId');
		const [hit] = await catalog.searchFoods(ZEYNEP, 'sutas');
		expect(Object.keys(hit)).not.toContain('ownerId');
	});

	it('lets the worker read shared foods but not write them', async () => {
		const id = await catalog.createFood(MEHMET, food());
		const rows = await workerSql.begin(async (tx) => {
			await tx`select set_config('app.user_id', ${ZEYNEP}, true)`;
			return tx`select name from foods where id = ${id}`;
		});
		expect(rows.map((r) => r.name)).toEqual(['Ayran']);
		const write = workerSql.begin(async (tx) => {
			await tx`select set_config('app.user_id', ${ZEYNEP}, true)`;
			await tx`update foods set name = 'X' where id = ${id}`;
		});
		expect(await errorCode(write)).toBe('42501');
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
	it('lets only the creator, or an admin for shared foods, edit', async () => {
		const id = await catalog.createFood(MEHMET, food());
		expect(await errorCode(catalog.updateFood(ZEYNEP, id, 1, food({ name: 'Hacked' })))).toBe(
			'forbidden'
		);
		expect(await catalog.updateFood(ADMIN, id, 1, food({ name: 'Ayran (ev)' }))).toBe(2);
		expect(await catalog.updateFood(MEHMET, id, 2, food({ name: 'Ayran' }))).toBe(3);
	});

	it('does not let an admin make someone else’s food private', async () => {
		const id = await catalog.createFood(MEHMET, food());
		expect(await errorCode(catalog.updateFood(ADMIN, id, 1, food({ visibility: 'private' })))).toBe(
			'forbidden'
		);
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
					(tx) => tx`insert into foods (owner_id, visibility, name, search_key, basis, origin)
					values (${MEHMET}, 'shared', 'Fake', 'fake', '100g', 'manual')`
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
			await bad(`insert into foods (owner_id, visibility, name, search_key, basis, origin)
				values ('$owner', 'private', 'Slice', 'slice', 'serving', 'manual')`)
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
	it('makes a private variant that records its source', async () => {
		const id = await catalog.createFood(
			MEHMET,
			food({ servings: [{ name: 'glass', amount: 200, unit: 'ml' }] })
		);
		const variant = await catalog.makeVariant(ZEYNEP, id);
		const detail = await catalog.getFood(ZEYNEP, variant);
		expect(detail).toMatchObject({
			visibility: 'private',
			mine: true,
			derivedFrom: id,
			origin: 'variant'
		});
		expect(detail.nutrients).toHaveLength((await catalog.getFood(ZEYNEP, id)).nutrients.length);
		expect(detail.servings.map((s) => s.name)).toEqual(['glass']);
		expect(await errorCode(catalog.getFood(MEHMET, variant))).toBe('not_found');
	});

	it('hides archived foods from search and lets the creator restore them', async () => {
		const id = await catalog.createFood(MEHMET, food());
		await catalog.setArchived(MEHMET, id, true);
		expect(await catalog.searchFoods(ZEYNEP, 'ayran')).toEqual([]);
		expect((await catalog.getFood(ZEYNEP, id)).archived).toBe(true);
		expect(await errorCode(catalog.setArchived(ZEYNEP, id, false))).toBe('forbidden');
		await catalog.setArchived(MEHMET, id, false);
		expect(await catalog.searchFoods(ZEYNEP, 'ayran')).toHaveLength(1);
	});
});

describe('search', () => {
	beforeEach(async () => {
		await catalog.createFood(MEHMET, food());
		await catalog.createFood(
			MEHMET,
			food({ name: 'Körpe Ispanak', brand: 'Superfresh', basis: '100g' })
		);
		await catalog.createFood(
			MEHMET,
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

	it('ranks the person’s own foods before shared ones among real matches', async () => {
		await catalog.createFood(
			ZEYNEP,
			food({ name: 'Ayran', brand: 'Ev yapımı', visibility: 'private' })
		);
		const results = await catalog.searchFoods(ZEYNEP, 'ayran');
		expect(results.map((r) => [r.brand, r.mine])).toEqual([
			['Ev yapımı', true],
			['Sütaş', false]
		]);
		expect(results[1].kcal).toBe(36);
	});

	it('ranks boosted (recent) foods first among real matches', async () => {
		const own = await catalog.createFood(
			ZEYNEP,
			food({ name: 'Ayran', brand: 'Ev yapımı', visibility: 'private' })
		);
		const [shared] = (await catalog.searchFoods(ZEYNEP, 'sutas')).map((r) => r.id);
		const boosted = await catalog.searchFoods(ZEYNEP, 'ayran', 20, [shared]);
		expect(boosted.map((r) => r.id)).toEqual([shared, own]);
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

	it('never proposes another person’s private food', async () => {
		await catalog.createFood(
			MEHMET,
			food({ name: 'Gizli Börek', brand: null, visibility: 'private', basis: '100g' })
		);
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
		// Not even an admin reads someone's rows; the food itself is shared, its edit counts are not.
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

	it('are totalled for admins across the household, and only for admins', async () => {
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
		await catalog.createFood(ZEYNEP, food({ name: 'Zeynep’s shared food' }));
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
