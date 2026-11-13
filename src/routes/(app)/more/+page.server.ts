import { catalog, recipes } from '#lib/server/catalog.ts';
import { diary, savedMeals } from '#lib/server/diary.ts';
import { updates } from '#lib/server/updates.ts';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals }) => {
	const userId = locals.session!.userId;
	const [deleted, own, recipeList, meals, update] = await Promise.all([
		diary.trash(userId),
		catalog.ownFoods(userId, 0, 1),
		recipes.list(userId),
		savedMeals.list(userId),
		// Admins who asked for it see a newer version on the Household row; never a reason for More not to open.
		updates.status(userId, locals.session!.role === 'admin').catch(() => null)
	]);
	return {
		deletedCount: deleted.length,
		foodCount: own.total,
		recipeCount: recipeList.filter((r) => !r.archived).length,
		mealCount: meals.length,
		newerVersion: update?.latest ?? null
	};
};
