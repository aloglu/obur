import * as v from 'valibot';
import { catalog } from '#lib/server/catalog.ts';
import type { FoodSearchResult } from '#lib/shared/food-types.ts';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals, url }) => {
	const userId = locals.session!.userId;
	const own = await catalog.ownFoods(userId);
	// A food just saved from New food (`?saved=`), shown at the top when it isn't on the first page of the list.
	const id = url.searchParams.get('saved');
	let saved: (FoodSearchResult & { archived: boolean }) | null = null;
	if (id && v.safeParse(v.pipe(v.string(), v.uuid()), id).success) {
		saved = own.foods.find((f) => f.id === id) ?? null;
		if (!saved) {
			const [food] = await catalog.foodsById(userId, [id]);
			if (food?.mine)
				saved = {
					id: food.id,
					name: food.name,
					brand: food.brand,
					basis: food.basis,
					servingLabel: food.servingLabel,
					icon: food.icon,
					visibility: food.visibility,
					mine: true,
					kcal: food.nutrients.find((n) => n.code === 'energy_kcal')?.value ?? null,
					archived: food.archived
				};
		}
	}
	return { own, saved };
};
