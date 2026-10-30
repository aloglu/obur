import { savedMeals } from '#lib/server/diary.ts';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals }) => ({
	meals: await savedMeals.list(locals.session!.userId)
});
