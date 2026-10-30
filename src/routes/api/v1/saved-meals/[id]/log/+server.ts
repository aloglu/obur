import { error, json } from '@sveltejs/kit';
import * as v from 'valibot';
import { respondDiary, savedMeals } from '#lib/server/diary.ts';
import { readJson } from '#lib/server/http.ts';
import { LogSavedMeal } from '#lib/shared/diary-input.ts';
import type { RequestHandler } from './$types';

/** POST { date, meal, zone, items: [{ itemId, entryId }] }: logs the chosen items as entries, all or nothing. */
export const POST: RequestHandler = ({ params, request, locals }) =>
	respondDiary(async () => {
		if (!v.safeParse(v.pipe(v.string(), v.uuid()), params.id).success) error(404, 'Not found');
		const body = await readJson(request, LogSavedMeal);
		const entries = await savedMeals.log(
			locals.session!.userId,
			params.id,
			{ localDate: body.date, meal: body.meal, zone: body.zone },
			body.items
		);
		return json({ entries }, { status: 201 });
	});
