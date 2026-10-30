// Curated generic foods against real PostgreSQL: loaded as the schema owner, used by people as the runtime role.
import { randomUUID } from 'node:crypto';
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { afterAll, beforeEach, describe, expect, inject, it } from 'vitest';
import { snapshotNutrients } from '../../../shared/diary-rules.ts';
import { loadCuratedFoods, readCuratedFile, type CuratedFile } from './curated.ts';
import { CatalogError, createCatalog } from './service.ts';

const urls = inject('db');
const quiet = { onnotice: () => {} };
const admin = postgres(urls.admin, { max: 1, ...quiet });
const migrator = postgres(urls.migrator, { max: 1, ...quiet });
const appSql = postgres(urls.app, { max: 2, ...quiet });
const catalog = createCatalog(drizzle(appSql));

const ADMIN = randomUUID();
const MEHMET = randomUUID();

const real = readCuratedFile();
const subset = (...names: string[]): CuratedFile => ({
	...real,
	foods: real.foods.filter((f) => names.includes(f.name))
});

beforeEach(async () => {
	await admin`truncate users, foods cascade`;
	await admin`insert into users (id, display_name, role) values
		(${ADMIN}, 'Ayşe', 'admin'), (${MEHMET}, 'Mehmet', 'member')`;
});

afterAll(async () => {
	await Promise.all([admin.end(), migrator.end(), appSql.end()]);
});

describe('loading', () => {
	it('loads the whole list once; loading again changes nothing', async () => {
		expect(await loadCuratedFoods(migrator, real)).toMatchObject({ added: real.foods.length });
		expect(await loadCuratedFoods(migrator, real)).toEqual({
			added: 0,
			updated: 0,
			unchanged: real.foods.length
		});
		const [{ n }] = await admin`select count(*)::int as n from foods where origin = 'curated'`;
		expect(n).toBe(real.foods.length);
	});

	it('follows renames, new aliases and new portion names, but never overwrites an edited food', async () => {
		await loadCuratedFoods(migrator, subset('Walnuts', 'Banana'));
		const renamed = subset('Walnuts', 'Banana');
		renamed.foods = renamed.foods.map((f) =>
			f.name === 'Walnuts'
				? {
						...f,
						name: 'Walnuts, shelled',
						aliases: ['ceviz içi'],
						portions: [{ name: '14 halves (renamed)', grams: 28.35 }]
					}
				: f
		);
		const [banana] = await catalog.searchFoods(ADMIN, 'banana');
		const detail = await catalog.getFood(ADMIN, banana.id);
		await catalog.updateFood(ADMIN, banana.id, 1, {
			name: 'Banana (edited)',
			brand: null,
			visibility: 'shared',
			basis: '100g',
			servingLabel: null,
			servingSize: null,
			barcode: null,
			nutrients: detail.nutrients,
			servings: detail.servings.map(({ name, amount, unit }) => ({
				name,
				amount,
				unit,
				source: 'reference' as const
			}))
		});
		renamed.foods = renamed.foods.map((f) => (f.name === 'Banana' ? { ...f, name: 'Bananas' } : f));
		expect(await loadCuratedFoods(migrator, renamed)).toEqual({
			added: 0,
			updated: 1,
			unchanged: 1
		});
		const [walnuts] = await catalog.searchFoods(MEHMET, 'ceviz ici');
		expect(walnuts.name).toBe('Walnuts, shelled');
		expect((await catalog.getFood(MEHMET, walnuts.id)).servings.map((s) => s.name)).toEqual([
			'14 halves (renamed)'
		]);
		// The edit stays, and so do the food's aliases.
		expect((await catalog.searchFoods(MEHMET, 'muz')).map((f) => f.name)).toEqual([
			'Banana (edited)'
		]);
	});
});

describe('using curated foods', () => {
	it('finds them by Turkish aliases without accents and shares them with everyone', async () => {
		await loadCuratedFoods(migrator, real);
		const names = async (q: string) => (await catalog.searchFoods(MEHMET, q)).map((f) => f.name);
		expect(await names('ceviz')).toContain('Walnuts');
		expect(await names('tavuk gogsu')).toEqual(
			expect.arrayContaining([
				'Chicken breast, raw (skinless)',
				'Chicken breast, roasted (meat only)'
			])
		);
		expect(await names('cay')).toContain('Black tea, brewed');
		expect(await names('walnuts')).toContain('Walnuts');
	});

	it('keeps USDA definitions: total carbohydrate as reported, excluding fibre only as an estimate', async () => {
		await loadCuratedFoods(migrator, subset('Banana'));
		const [hit] = await catalog.searchFoods(MEHMET, 'muz');
		const banana = await catalog.getFood(MEHMET, hit.id);
		expect(banana).toMatchObject({ basis: '100g', mine: false, editable: false });
		const by = Object.fromEntries(banana.nutrients.map((n) => [n.code, n]));
		expect(by.carbohydrate_total.qualifier).toBe('reported');
		expect(by.carbohydrate_excl_fibre.qualifier).toBe('estimate');
		// A medium banana is USDA's stated 118 g.
		const medium = banana.servings.find((s) => s.name.startsWith('medium'))!;
		expect(medium).toMatchObject({ amount: 118, unit: 'g' });
		const kcal = snapshotNutrients(
			{ ...banana, servingSize: null, basisNutrients: banana.nutrients },
			1,
			{ kind: 'serving', servingId: medium.id, name: medium.name, amount: 118, unit: 'g' }
		)?.energy_kcal?.value;
		expect(kcal).toBeCloseTo(89 * 1.18);
	});

	it('lets only an admin edit them, and nobody can claim them', async () => {
		await loadCuratedFoods(migrator, subset('Walnuts'));
		const [walnuts] = await catalog.searchFoods(MEHMET, 'walnuts');
		const detail = await catalog.getFood(MEHMET, walnuts.id);
		const input = {
			name: 'Mine',
			brand: null,
			visibility: 'private' as const,
			basis: '100g' as const,
			servingLabel: null,
			servingSize: null,
			barcode: null,
			nutrients: detail.nutrients,
			servings: []
		};
		let code: string | undefined;
		try {
			await catalog.updateFood(MEHMET, walnuts.id, 1, input);
		} catch (e) {
			code = (e as CatalogError).code;
		}
		expect(code).toBe('forbidden');
		// The ownership column is not even writable by the runtime role.
		await expect(
			appSql.begin(async (tx) => {
				await tx`select set_config('app.user_id', ${MEHMET}, true)`;
				return tx`update foods set owner_id = ${MEHMET} where id = ${walnuts.id}`;
			})
		).rejects.toMatchObject({ code: '42501' });
	});
});
