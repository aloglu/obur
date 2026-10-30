import { error, json } from '@sveltejs/kit';
import * as v from 'valibot';
import { catalog, recipes, respondCatalog } from '#lib/server/catalog.ts';
import { readJson } from '#lib/server/http.ts';
import type { RequestHandler } from './$types';

/** POST { version }: updates ingredients to the current values of foods the person can still see. */
export const POST: RequestHandler = ({ params, request, locals }) =>
	respondCatalog(async () => {
		if (!v.safeParse(v.pipe(v.string(), v.uuid()), params.id).success) error(404, 'Not found');
		const userId = locals.session!.userId;
		const body = await readJson(
			request,
			v.object({ version: v.pipe(v.number(), v.integer(), v.minValue(1)) })
		);
		const recipe = await recipes.get(userId, params.id);
		const ids = [...new Set(recipe.ingredients.flatMap((i) => (i.foodId ? [i.foodId] : [])))];
		const current = new Map((await catalog.foodsById(userId, ids)).map((f) => [f.id, f]));
		return json(await recipes.refresh(userId, params.id, body.version, current));
	});
