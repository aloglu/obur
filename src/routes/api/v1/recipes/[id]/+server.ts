import { error, json } from '@sveltejs/kit';
import * as v from 'valibot';
import { catalog, recipes, respondCatalog } from '#lib/server/catalog.ts';
import { readJson } from '#lib/server/http.ts';
import type { IngredientEdit } from '#lib/server/modules/catalog/index.ts';
import { resolveUnit } from '#lib/server/modules/diary/index.ts';
import { SaveRecipe } from '#lib/shared/recipe.ts';
import type { RequestHandler } from './$types';

const validId = (id: string) => {
	if (!v.safeParse(v.pipe(v.string(), v.uuid()), id).success) error(404, 'Not found');
	return id;
};

/** The recipe with its ingredients, for its owner only (others get 404 and see the food instead). */
export const GET: RequestHandler = ({ params, locals }) =>
	respondCatalog(async () => json(await recipes.get(locals.session!.userId, validId(params.id))));

/**
 * PUT { version | null, name, visibility, servings, cookedYieldG, ingredients }: creates the recipe (version null)
 * or replaces it. Units resolve against each kept ingredient's snapshot, or a new food as the person sees it now.
 */
export const PUT: RequestHandler = ({ params, request, locals }) =>
	respondCatalog(async () => {
		const id = validId(params.id);
		const userId = locals.session!.userId;
		const body = await readJson(request, SaveRecipe);
		const kept =
			body.version === null
				? new Map()
				: new Map((await recipes.get(userId, id)).ingredients.map((i) => [i.id, i]));
		const foodIds = [
			...new Set(body.ingredients.flatMap((i) => ('foodId' in i ? [i.foodId] : [])))
		];
		const foods = new Map((await catalog.foodsById(userId, foodIds)).map((f) => [f.id, f]));
		const measures = await catalog.householdMeasures();
		const ingredients = body.ingredients.map((item): IngredientEdit => {
			if ('foodId' in item) {
				const food = foods.get(item.foodId);
				if (!food) error(404, 'Not found');
				const unit = resolveUnit(item.unit, food.servings, measures);
				if (!unit) error(422, 'Unknown unit for this food');
				return { food, amount: item.amount, unit };
			}
			if (!item.unit) return { ingredientId: item.ingredientId, amount: item.amount };
			const servings = kept.get(item.ingredientId)?.food.servings ?? [];
			const unit = resolveUnit(item.unit, servings, measures);
			if (!unit) error(422, 'Unknown unit for this food');
			return { ingredientId: item.ingredientId, amount: item.amount, unit };
		});
		return json(await recipes.save(userId, { ...body, id, ingredients }));
	});
