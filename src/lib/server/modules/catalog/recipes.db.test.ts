// Recipes against real PostgreSQL, run as the runtime roles: values, pinning, edits, privacy and deletion.
import { randomUUID } from 'node:crypto';
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as v from 'valibot';
import { afterAll, beforeEach, describe, expect, inject, it } from 'vitest';
import { FoodInput } from '../../../shared/food-input.ts';
import { createRecipes, type RecipeSave } from './recipes.ts';
import { CatalogError, createCatalog } from './service.ts';

const urls = inject('db');
const quiet = { onnotice: () => {} };
const admin = postgres(urls.admin, { max: 1, ...quiet });
const appSql = postgres(urls.app, { max: 2, ...quiet });
const db = drizzle(appSql);
const catalog = createCatalog(db);
const recipes = createRecipes(db);

const ADMIN = randomUUID();
const MEHMET = randomUUID();
const ZEYNEP = randomUUID();
const grams = (amount: number) => ({ amount, unit: { kind: 'mass' as const, unit: 'g' as const } });

const food = (name: string, kcal: number, protein: number, visibility = 'shared') =>
	v.parse(FoodInput, {
		name,
		brand: null,
		visibility,
		basis: '100g',
		nutrients: [
			{ code: 'energy_kcal', value: kcal, qualifier: 'reported' },
			{ code: 'protein', value: protein, qualifier: 'reported' }
		]
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

const asUser = <T>(userId: string, run: (tx: postgres.TransactionSql) => Promise<T>) =>
	appSql.begin(async (tx) => {
		await tx`select set_config('app.user_id', ${userId}, true)`;
		return run(tx);
	}) as Promise<T>;

let lentilsId: string;
let onionId: string;

/** Mercimek çorbası: 200 g of Mehmet's private lentils and 100 g of Zeynep's shared onion, 4 servings. */
async function soup(overrides: Partial<RecipeSave> = {}) {
	const [lentils, onion] = await Promise.all([
		catalog.getFood(MEHMET, lentilsId),
		catalog.getFood(MEHMET, onionId)
	]);
	return recipes.save(MEHMET, {
		id: randomUUID(),
		version: null,
		name: 'Mercimek çorbası',
		visibility: 'shared',
		servings: 4,
		cookedYieldG: 1200,
		ingredients: [
			{ food: lentils, ...grams(200) },
			{ food: onion, ...grams(100) }
		],
		...overrides
	});
}

beforeEach(async () => {
	await admin`truncate users, foods cascade`;
	await admin`insert into users (id, display_name, role) values
		(${ADMIN}, 'Admin', 'admin'), (${MEHMET}, 'Mehmet', 'member'), (${ZEYNEP}, 'Zeynep', 'member')`;
	lentilsId = await catalog.createFood(MEHMET, food('Kırmızı mercimek', 350, 24, 'private'));
	onionId = await catalog.createFood(ZEYNEP, food('Kuru soğan', 40, 1.1));
});

afterAll(async () => {
	await Promise.all([admin.end(), appSql.end()]);
});

describe('values', () => {
	it('is a food per serving: the ingredients summed and divided, with a serving weight from the cooked dish', async () => {
		const recipe = await soup();
		expect(recipe).toMatchObject({ servings: 4, cookedYieldG: 1200, version: 1 });
		const asFood = await catalog.getFood(MEHMET, recipe.id);
		expect(asFood).toMatchObject({
			origin: 'recipe',
			basis: 'serving',
			servingLabel: 'serving',
			servingSize: { amount: 300, unit: 'g' }
		});
		// (700 + 40) / 4 = 185 kcal; (48 + 1.1) / 4 = 12.275 g protein.
		const value = (code: string) => asFood.nutrients.find((n) => n.code === code);
		expect(value('energy_kcal')).toMatchObject({ value: 185, qualifier: 'derived' });
		expect(value('protein')).toMatchObject({ value: 12.275, qualifier: 'derived' });
		// Without the cooked weight there is no per-gram size: it is never guessed from the raw ingredients.
		const unweighed = await soup({ cookedYieldG: null, name: 'Tartılmamış' });
		expect((await catalog.getFood(MEHMET, unweighed.id)).servingSize).toBeNull();
		expect((await catalog.searchFoods(ZEYNEP, 'mercimek corbasi')).map((r) => r.id)).toContain(
			recipe.id
		);
	});
});

describe('pinning and editing', () => {
	it('keeps its values when an ingredient food changes, until refreshed', async () => {
		const recipe = await soup();
		await catalog.updateFood(ZEYNEP, onionId, 1, food('Kuru soğan', 80, 1.1));
		const kcal = async () =>
			(await catalog.getFood(MEHMET, recipe.id)).nutrients.find((n) => n.code === 'energy_kcal')
				?.value;
		expect(await kcal()).toBe(185);
		const current = new Map(
			(await catalog.foodsById(MEHMET, [lentilsId, onionId])).map((f) => [f.id, f])
		);
		const result = await recipes.refresh(MEHMET, recipe.id, 1, current);
		expect(result).toMatchObject({ refreshed: 2, kept: 0 });
		expect(await kcal()).toBe(195);
		expect(await errorCode(recipes.refresh(MEHMET, recipe.id, 1, current))).toBe('conflict');
	});

	it('replaces name, servings and ingredients in one step, with version checks', async () => {
		const recipe = await soup();
		const [lentils] = recipe.ingredients;
		const edited = await recipes.save(MEHMET, {
			id: recipe.id,
			version: 1,
			name: 'Mercimek çorbası (büyük)',
			visibility: 'private',
			servings: 5,
			cookedYieldG: null,
			ingredients: [{ ingredientId: lentils.id, amount: 300 }]
		});
		expect(edited).toMatchObject({ version: 2, servings: 5, visibility: 'private' });
		expect(edited.ingredients).toHaveLength(1);
		expect((await catalog.getFood(MEHMET, recipe.id)).nutrients[0]).toMatchObject({
			code: 'energy_kcal',
			value: 210
		});
		const stale = { ...edited, version: 1, ingredients: [{ ingredientId: lentils.id }] };
		expect(await errorCode(recipes.save(MEHMET, stale))).toBe('conflict');
		// No recipe inside a recipe, and no unit the food can't convert.
		const asIngredient = await catalog.getFood(MEHMET, recipe.id);
		const nested = {
			...edited,
			ingredients: [{ food: asIngredient, amount: 1, unit: { kind: 'basis_serving' as const } }]
		};
		expect(await errorCode(recipes.save(MEHMET, nested))).toBe('forbidden');
		const ml = {
			...edited,
			ingredients: [
				{ ingredientId: lentils.id, unit: { kind: 'volume' as const, unit: 'ml' as const } }
			]
		};
		expect(await errorCode(recipes.save(MEHMET, ml))).toBe('conversion_unknown');
		// The food form can't overwrite a recipe's values, even for its owner.
		expect(await errorCode(catalog.updateFood(MEHMET, recipe.id, 2, food('X', 1, 1)))).toBe(
			'forbidden'
		);
	});

	it('creates idempotently by ID while the name matches', async () => {
		const recipe = await soup();
		const again = await recipes.save(MEHMET, {
			id: recipe.id,
			version: null,
			name: 'Mercimek çorbası',
			visibility: 'shared',
			servings: 4,
			cookedYieldG: 1200,
			ingredients: [{ food: await catalog.getFood(MEHMET, onionId), ...grams(1) }]
		});
		expect(again.ingredients).toHaveLength(2);
		expect(await errorCode(soup({ id: recipe.id, name: 'Başka' }))).toBe('conflict');
	});
});

describe('privacy', () => {
	it('shows others a shared recipe as a plain food, never its ingredients', async () => {
		const recipe = await soup();
		expect((await catalog.getFood(ZEYNEP, recipe.id)).nutrients.length).toBeGreaterThan(0);
		expect(await errorCode(recipes.get(ZEYNEP, recipe.id))).toBe('not_found');
		expect(await errorCode(recipes.get(ADMIN, recipe.id))).toBe('not_found');
		expect(await asUser(ZEYNEP, (tx) => tx`select id from recipe_ingredients`)).toHaveLength(0);
		expect(await asUser(ADMIN, (tx) => tx`select food_id from recipes`)).toHaveLength(0);
		// Nobody else edits it: not through the recipe, nor (even an admin) through the food form.
		expect(
			await errorCode(
				recipes.save(ZEYNEP, {
					...recipe,
					version: 1,
					ingredients: [{ ingredientId: recipe.ingredients[0].id }]
				})
			)
		).toBe('forbidden');
		expect(await errorCode(catalog.updateFood(ADMIN, recipe.id, 1, food('X', 1, 1)))).toBe(
			'forbidden'
		);
		// The database lets a recipe row sit only on one's own food, and ingredients only in one's own recipe.
		expect(
			await errorCode(
				asUser(
					ZEYNEP,
					(tx) =>
						tx`insert into recipes (food_id, owner_id, servings) values (${onionId}, ${ZEYNEP}, 1)`
				)
			)
		).toBeUndefined();
		expect(
			await errorCode(
				asUser(
					ZEYNEP,
					(tx) =>
						tx`insert into recipes (food_id, owner_id, servings) values (${lentilsId}, ${ZEYNEP}, 1)`
				)
			)
		).toBe('42501');
		expect(
			await errorCode(
				asUser(
					ZEYNEP,
					(
						tx
					) => tx`insert into recipe_ingredients (recipe_id, owner_id, position, food, amount, unit, nutrients)
						values (${recipe.id}, ${ZEYNEP}, 5, '{}', 1, '{}', '{}')`
				)
			)
		).toBe('42501');
	});

	it('removes the ingredient list with the account, even when the recipe stays shared', async () => {
		const recipe = await soup();
		await asUser(MEHMET, (tx) => tx`select app_delete_account(${MEHMET}, false)`);
		const kept = await catalog.getFood(ZEYNEP, recipe.id);
		expect(kept.nutrients.find((n) => n.code === 'energy_kcal')?.value).toBe(185);
		expect(await admin`select 1 from recipes`).toHaveLength(0);
		expect(await admin`select 1 from recipe_ingredients`).toHaveLength(0);
	});
});
