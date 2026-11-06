import { error } from '@sveltejs/kit';
import * as v from 'valibot';
import { catalog } from '#lib/server/catalog.ts';
import { savedMeals } from '#lib/server/diary.ts';
import { anyValuesChanged } from '#lib/shared/diary-rules.ts';
import { DiaryError } from '#lib/server/modules/diary/index.ts';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ params, locals }) => {
	if (!v.safeParse(v.pipe(v.string(), v.uuid()), params.id).success) error(404, 'Not found');
	try {
		const userId = locals.session!.userId;
		const meal = await savedMeals.get(userId, params.id);
		const ids = meal.items.flatMap((i) => (i.foodId ? [i.foodId] : []));
		return { meal, stale: anyValuesChanged(meal.items, await catalog.foodsById(userId, ids)) };
	} catch (e) {
		if (e instanceof DiaryError && e.code === 'not_found') error(404, 'Not found');
		throw e;
	}
};
