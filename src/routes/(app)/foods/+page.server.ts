import { catalog } from '#lib/server/catalog.ts';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals }) => ({
	own: await catalog.ownFoods(locals.session!.userId)
});
