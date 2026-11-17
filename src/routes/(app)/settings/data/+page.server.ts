import { catalog } from '#lib/server/catalog.ts';
import type { PageServerLoad } from './$types';

// What the page shows about the person's data arrives with it, never fetched after it opens: the foods from a
// LoseIt import (archived or not).
export const load: PageServerLoad = async ({ locals }) => ({
	imported: await catalog.importedFoods(locals.session!.userId)
});
