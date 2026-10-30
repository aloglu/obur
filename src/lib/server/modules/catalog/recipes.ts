// Recipes (docs/design.md, "Food catalog and recipes"): a recipe is a food (origin 'recipe', per serving) with an
// ingredient list only its owner sees. Ingredients keep snapshots like diary entries; the recipe's values are
// recomputed from them on every save, and catalog edits reach them only through an explicit refresh.
import { randomUUID } from 'node:crypto';
import { and, asc, eq } from 'drizzle-orm';
import { withUser, type Database, type Tx } from '../../db/identity.ts';
import { snapshotNutrients, snapshotOf } from '../../../shared/diary-rules.ts';
import type { SnapshotUnit } from '../../../shared/diary-types.ts';
import type { FoodDetail } from '../../../shared/food-types.ts';
import { deriveNutrients } from '../../../shared/nutrients.ts';
import { RECIPE_SERVING_LABEL, recipeNutrients, type Recipe } from '../../../shared/recipe.ts';
import { foodSearchKey } from '../../../shared/search-text.ts';
import { foodNutrients, foods, recipeIngredients, recipes } from './schema.ts';
import { CatalogError, load } from './service.ts';

export const MAX_INGREDIENTS = 100;

/** One ingredient of an edited recipe, units resolved: kept (re-scaled from its snapshot) or a new food. */
export type IngredientEdit =
	| { ingredientId: string; amount?: number; unit?: SnapshotUnit }
	| { food: FoodDetail; amount: number; unit: SnapshotUnit };

export interface RecipeSave {
	id: string;
	version: number | null;
	name: string;
	visibility: 'private' | 'shared';
	servings: number;
	cookedYieldG: number | null;
	ingredients: IngredientEdit[];
}

type IngredientRow = typeof recipeIngredients.$inferSelect;

async function loadRecipe(tx: Tx, id: string): Promise<Recipe> {
	const [row] = await tx
		.select({ food: foods, recipe: recipes })
		.from(recipes)
		.innerJoin(foods, eq(foods.id, recipes.foodId))
		.where(eq(recipes.foodId, id));
	if (!row) throw new CatalogError('not_found');
	const items = await tx
		.select()
		.from(recipeIngredients)
		.where(eq(recipeIngredients.recipeId, id))
		.orderBy(asc(recipeIngredients.position));
	return {
		id,
		name: row.food.name,
		visibility: row.food.visibility,
		version: row.food.version,
		servings: row.recipe.servings,
		cookedYieldG: row.recipe.cookedYieldG,
		archived: row.food.archivedAt !== null,
		ingredients: items.map((i) => ({
			id: i.id,
			foodId: i.foodId,
			food: i.food,
			amount: i.amount,
			unit: i.unit,
			nutrients: i.nutrients
		}))
	};
}

/** Rewrites the recipe's ingredient rows and its food's values (per serving) from them. */
async function writeContents(
	tx: Tx,
	userId: string,
	id: string,
	servings: number,
	rows: Omit<IngredientRow, 'recipeId' | 'ownerId' | 'position'>[]
) {
	await tx.delete(recipeIngredients).where(eq(recipeIngredients.recipeId, id));
	await tx
		.insert(recipeIngredients)
		.values(rows.map((r, position) => ({ ...r, recipeId: id, ownerId: userId, position })));
	const values = deriveNutrients(
		recipeNutrients(
			rows.map((r) => r.nutrients),
			servings
		)
	);
	await tx.delete(foodNutrients).where(eq(foodNutrients.foodId, id));
	if (values.length)
		await tx.insert(foodNutrients).values(values.map((n) => ({ ...n, foodId: id })));
}

/** A serving's weight when the finished dish was weighed. */
const servingSize = (servings: number, cookedYieldG: number | null) =>
	cookedYieldG
		? {
				servingAmount: Math.round((cookedYieldG / servings) * 10_000) / 10_000,
				servingUnit: 'g' as const
			}
		: { servingAmount: null, servingUnit: null };

export function createRecipes(db: Database, now: () => Date = () => new Date()) {
	return {
		/** The recipe with its ingredients, for its owner only. */
		async get(userId: string, id: string): Promise<Recipe> {
			return withUser(db, userId, (tx) => loadRecipe(tx, id));
		},

		/**
		 * Creates (`version` null, idempotent by ID while the name matches) or replaces a recipe and recomputes its
		 * values, in one transaction. A replace needs the version it was edited from.
		 */
		async save(userId: string, input: RecipeSave): Promise<Recipe> {
			if (input.ingredients.length === 0 || input.ingredients.length > MAX_INGREDIENTS)
				throw new CatalogError('not_found');
			return withUser(db, userId, async (tx) => {
				const existing = await load(tx, input.id);
				if (input.version === null && existing) {
					if (existing.origin !== 'recipe' || !existing.mine || existing.name !== input.name)
						throw new CatalogError('conflict');
					return loadRecipe(tx, input.id);
				}
				let old = new Map<string, IngredientRow>();
				if (input.version !== null) {
					if (!existing || existing.origin !== 'recipe') throw new CatalogError('not_found');
					if (!existing.mine) throw new CatalogError('forbidden');
					if (existing.version !== input.version) throw new CatalogError('conflict');
					old = new Map(
						(
							await tx
								.select()
								.from(recipeIngredients)
								.where(eq(recipeIngredients.recipeId, input.id))
						).map((r) => [r.id, r])
					);
				}
				const seen = new Set<string>();
				const rows = input.ingredients.map((item) => {
					if ('food' in item) {
						if (item.food.origin === 'recipe') throw new CatalogError('forbidden');
						const food = snapshotOf(item.food);
						const nutrients = snapshotNutrients(food, item.amount, item.unit);
						if (!nutrients) throw new CatalogError('conversion_unknown');
						return {
							id: randomUUID(),
							foodId: item.food.id,
							food,
							amount: item.amount,
							unit: item.unit,
							nutrients
						};
					}
					const row = old.get(item.ingredientId);
					if (!row || seen.has(item.ingredientId)) throw new CatalogError('not_found');
					seen.add(item.ingredientId);
					const kept = {
						id: row.id,
						foodId: row.foodId,
						food: row.food,
						amount: row.amount,
						unit: row.unit,
						nutrients: row.nutrients
					};
					if (item.amount === undefined && !item.unit) return kept;
					const amount = item.amount ?? row.amount;
					const unit = item.unit ?? row.unit;
					const nutrients = snapshotNutrients(row.food, amount, unit);
					if (!nutrients) throw new CatalogError('conversion_unknown');
					return { ...kept, amount, unit, nutrients };
				});
				const columns = {
					name: input.name,
					searchKey: foodSearchKey(input.name, null),
					visibility: input.visibility,
					...servingSize(input.servings, input.cookedYieldG)
				};
				if (existing) {
					await tx
						.update(foods)
						.set({ ...columns, version: existing.version + 1, updatedAt: now() })
						.where(and(eq(foods.id, input.id), eq(foods.version, existing.version)));
					await tx
						.update(recipes)
						.set({ servings: input.servings, cookedYieldG: input.cookedYieldG })
						.where(eq(recipes.foodId, input.id));
				} else {
					try {
						await tx.insert(foods).values({
							...columns,
							id: input.id,
							ownerId: userId,
							origin: 'recipe',
							brand: null,
							basis: 'serving',
							servingLabel: RECIPE_SERVING_LABEL,
							barcode: null
						});
					} catch (e) {
						// Someone else's food with this ID, invisible under RLS.
						if ((e as { cause?: { code?: string } }).cause?.code === '23505')
							throw new CatalogError('conflict');
						throw e;
					}
					await tx.insert(recipes).values({
						foodId: input.id,
						ownerId: userId,
						servings: input.servings,
						cookedYieldG: input.cookedYieldG
					});
				}
				await writeContents(tx, userId, input.id, input.servings, rows);
				return loadRecipe(tx, input.id);
			});
		},

		/**
		 * Updates ingredients to the current values of foods the person can still see, keeping amount and unit;
		 * those whose food is gone, hidden or no longer convertible keep their snapshot.
		 */
		async refresh(
			userId: string,
			id: string,
			expectedVersion: number,
			current: Map<string, FoodDetail>
		): Promise<{ recipe: Recipe; refreshed: number; kept: number }> {
			return withUser(db, userId, async (tx) => {
				const recipe = await loadRecipe(tx, id);
				if (recipe.version !== expectedVersion) throw new CatalogError('conflict');
				let refreshed = 0;
				const rows = recipe.ingredients.map((i) => {
					const food = i.foodId ? current.get(i.foodId) : undefined;
					const serving =
						food && i.unit.kind === 'serving'
							? (food.servings.find((s) => s.id === (i.unit as { servingId: string }).servingId) ??
								food.servings.find(
									(s) =>
										s.name.toLocaleLowerCase('tr') ===
										(i.unit as { name: string }).name.toLocaleLowerCase('tr')
								))
							: undefined;
					const unit: SnapshotUnit | undefined =
						i.unit.kind !== 'serving'
							? i.unit
							: serving && {
									kind: 'serving',
									servingId: serving.id,
									name: serving.name,
									amount: serving.amount,
									unit: serving.unit
								};
					const snapshot = food && snapshotOf(food);
					const nutrients = snapshot && unit && snapshotNutrients(snapshot, i.amount, unit);
					if (!snapshot || !unit || !nutrients) return i;
					refreshed += 1;
					return { ...i, food: snapshot, unit, nutrients };
				});
				await tx
					.update(foods)
					.set({ version: recipe.version + 1, updatedAt: now() })
					.where(eq(foods.id, id));
				await writeContents(tx, userId, id, recipe.servings, rows);
				return { recipe: await loadRecipe(tx, id), refreshed, kept: rows.length - refreshed };
			});
		}
	};
}

export type Recipes = ReturnType<typeof createRecipes>;
