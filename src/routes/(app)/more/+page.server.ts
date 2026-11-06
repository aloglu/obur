import { catalog, recipes } from '#lib/server/catalog.ts';
import { diary, savedMeals } from '#lib/server/diary.ts';
import { goals } from '#lib/server/goals.ts';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals, parent }) => {
	const { today } = await parent();
	const userId = locals.session!.userId;
	const [deleted, target, own, recipeList, meals] = await Promise.all([
		diary.trash(userId),
		goals.targetFor(userId, today),
		catalog.ownFoods(userId, 0, 1),
		recipes.list(userId),
		savedMeals.list(userId)
	]);
	const requested = target?.inputs.requestedRateKgPerWeek;
	return {
		deletedCount: deleted.length,
		foodCount: own.total,
		recipeCount: recipeList.filter((r) => !r.archived).length,
		mealCount: meals.length,
		/** The pace a calculated budget asks for, for the Goal row. */
		goal:
			target?.mode === 'calculated'
				? typeof requested === 'number'
					? requested
					: (target.rateKgPerWeek ?? 0)
				: null
	};
};
