import { error } from '@sveltejs/kit';
import * as v from 'valibot';
import { savedMeals } from '#lib/server/diary.ts';
import { DiaryError } from '#lib/server/modules/diary/index.ts';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ params, locals }) => {
	if (!v.safeParse(v.pipe(v.string(), v.uuid()), params.id).success) error(404, 'Not found');
	try {
		return { meal: await savedMeals.get(locals.session!.userId, params.id) };
	} catch (e) {
		if (e instanceof DiaryError && e.code === 'not_found') error(404, 'Not found');
		throw e;
	}
};
