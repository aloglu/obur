import { catalog, recipes } from '#lib/server/catalog.ts';
import { diary, savedMeals } from '#lib/server/diary.ts';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals }) => {
	const userId = locals.session!.userId;
	const [deleted, own, recipeList, meals] = await Promise.all([
		diary.trash(userId),
		catalog.ownFoods(userId, 0, 1),
		recipes.list(userId),
		savedMeals.list(userId)
	]);
	return {
		deletedCount: deleted.length,
		foodCount: own.total,
		recipeCount: recipeList.filter((r) => !r.archived).length,
		mealCount: meals.length
	};
};
