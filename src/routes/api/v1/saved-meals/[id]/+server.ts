import { error, json } from '@sveltejs/kit';
import * as v from 'valibot';
import { respondDiary, savedMeals } from '#lib/server/diary.ts';
import { readJson } from '#lib/server/http.ts';
import { RenameSavedMeal } from '#lib/shared/diary-input.ts';
import type { RequestHandler } from './$types';

const validId = (id: string) => {
	if (!v.safeParse(v.pipe(v.string(), v.uuid()), id).success) error(404, 'Not found');
	return id;
};

export const GET: RequestHandler = ({ params, locals }) =>
	respondDiary(async () => json(await savedMeals.get(locals.session!.userId, validId(params.id))));

/** PATCH { revision, name }: renames; a stale revision gets 409. */
export const PATCH: RequestHandler = ({ params, request, locals }) =>
	respondDiary(async () => {
		const id = validId(params.id);
		const body = await readJson(request, RenameSavedMeal);
		return json(await savedMeals.rename(locals.session!.userId, id, body.revision, body.name));
	});

/** Deletes the saved meal; entries logged from it stay. */
export const DELETE: RequestHandler = ({ params, locals }) =>
	respondDiary(async () => {
		await savedMeals.remove(locals.session!.userId, validId(params.id));
		return json({ ok: true });
	});
