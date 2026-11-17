import { catalog } from '#lib/server/catalog.ts';
import { diary, savedMeals } from '#lib/server/diary.ts';
import type { PageServerLoad } from './$types';

// Everything in the trash, by kind (docs/ui.md, "Archived and deleted"): diary entries, foods, recipes and saved meals.
export const load: PageServerLoad = async ({ locals }) => {
	const userId = locals.session!.userId;
	const [entries, foods, meals] = await Promise.all([
		diary.trash(userId),
		catalog.trash(userId),
		savedMeals.trash(userId)
	]);
	return {
		entries,
		foods: foods.filter((f) => !f.recipe),
		recipes: foods.filter((f) => f.recipe),
		meals
	};
};
