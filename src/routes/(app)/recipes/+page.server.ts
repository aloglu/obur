import { recipes } from '#lib/server/catalog.ts';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals }) => ({
	recipes: await recipes.list(locals.session!.userId)
});
