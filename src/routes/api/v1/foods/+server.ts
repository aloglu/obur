import { json } from '@sveltejs/kit';
import * as v from 'valibot';
import { catalog, respondCatalog } from '#lib/server/catalog.ts';
import { diary } from '#lib/server/diary.ts';
import { readJson } from '#lib/server/http.ts';
import { FoodInput } from '#lib/shared/food-input.ts';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = ({ url, locals }) =>
	respondCatalog(async () => {
		const userId = locals.session!.userId;
		const q = (url.searchParams.get('q') ?? '').slice(0, 200);
		const recent = await diary.recentFoodIds(userId, 20);
		return json({ results: await catalog.searchFoods(userId, q, 20, recent) });
	});

export const POST: RequestHandler = ({ request, locals }) =>
	respondCatalog(async () => {
		const body = await readJson(request, v.object({ food: FoodInput }));
		return json(
			{ id: await catalog.createFood(locals.session!.userId, body.food) },
			{ status: 201 }
		);
	});
