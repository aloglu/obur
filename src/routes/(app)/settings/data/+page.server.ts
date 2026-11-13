import { catalog } from '#lib/server/catalog.ts';
import { portability } from '#lib/server/portability.ts';
import type { PageServerLoad } from './$types';

// What the page shows about the person's data arrives with it, never fetched after it opens: the foods from a
// LoseIt import (archived or not), and how many foods they share (deleting the account asks about those).
export const load: PageServerLoad = async ({ locals }) => {
	const userId = locals.session!.userId;
	const [imported, sharedFoods] = await Promise.all([
		catalog.importedFoods(userId),
		portability.sharedFoodCount(userId)
	]);
	return { imported, sharedFoods };
};
