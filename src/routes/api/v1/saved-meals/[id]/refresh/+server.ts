import { error, json } from '@sveltejs/kit';
import * as v from 'valibot';
import { catalog } from '#lib/server/catalog.ts';
import { respondDiary, savedMeals } from '#lib/server/diary.ts';
import { readJson } from '#lib/server/http.ts';
import { RefreshSavedMeal } from '#lib/shared/diary-input.ts';
import type { RequestHandler } from './$types';

/** POST { revision }: updates food items to the current values of foods the person can still see. */
export const POST: RequestHandler = ({ params, request, locals }) =>
	respondDiary(async () => {
		if (!v.safeParse(v.pipe(v.string(), v.uuid()), params.id).success) error(404, 'Not found');
		const userId = locals.session!.userId;
		const body = await readJson(request, RefreshSavedMeal);
		const meal = await savedMeals.get(userId, params.id);
		const ids = [...new Set(meal.items.flatMap((i) => (i.foodId ? [i.foodId] : [])))];
		const foods = new Map((await catalog.foodsById(userId, ids)).map((f) => [f.id, f]));
		return json(await savedMeals.refresh(userId, params.id, body.revision, foods));
	});
