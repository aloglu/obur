import { json } from '@sveltejs/kit';
import * as v from 'valibot';
import { respondDiary, savedMeals } from '#lib/server/diary.ts';
import { readJson } from '#lib/server/http.ts';
import type { RequestHandler } from './$types';

/** POST { ids }: brings saved meals back from Recently deleted, all or none. */
export const POST: RequestHandler = ({ request, locals }) =>
	respondDiary(async () => {
		const body = await readJson(
			request,
			v.object({
				ids: v.pipe(v.array(v.pipe(v.string(), v.uuid())), v.minLength(1), v.maxLength(500))
			})
		);
		await savedMeals.restore(locals.session!.userId, body.ids);
		return json({ ok: true });
	});
