import { catalog } from '#lib/server/catalog.ts';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals }) => ({
	archive: await catalog.ownFoods(locals.session!.userId, 0, 50, { archived: true })
});
