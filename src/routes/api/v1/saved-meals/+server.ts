import { json } from '@sveltejs/kit';
import { respondDiary, savedMeals } from '#lib/server/diary.ts';
import { readJson } from '#lib/server/http.ts';
import { CreateSavedMeal } from '#lib/shared/diary-input.ts';
import type { RequestHandler } from './$types';

/** GET /api/v1/saved-meals: the person's saved meals, most recently changed first. */
export const GET: RequestHandler = async ({ locals }) =>
	json({ meals: await savedMeals.list(locals.session!.userId) });

/** POST /api/v1/saved-meals { id?, name, entryIds }: saves live diary entries as a meal. */
export const POST: RequestHandler = ({ request, locals }) =>
	respondDiary(async () => {
		const body = await readJson(request, CreateSavedMeal);
		return json(await savedMeals.createFromEntries(locals.session!.userId, body), { status: 201 });
	});
