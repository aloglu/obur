import { json } from '@sveltejs/kit';
import { catalog } from '#lib/server/catalog.ts';
import { diary } from '#lib/server/diary.ts';
import type { FoodSearchResult } from '#lib/shared/food-types.ts';
import type { RequestHandler } from './$types';

/** Recently logged foods that are still visible and not archived, newest first (Log suggestions). */
export const GET: RequestHandler = async ({ locals }) => {
	const userId = locals.session!.userId;
	const ids = await diary.recentFoodIds(userId, 12);
	const foods = await catalog.foodsById(userId, ids);
	const byId = new Map(foods.filter((f) => !f.archived).map((f) => [f.id, f]));
	const results: FoodSearchResult[] = ids.flatMap((id) => {
		const f = byId.get(id);
		if (!f) return [];
		return [
			{
				id: f.id,
				name: f.name,
				brand: f.brand,
				basis: f.basis,
				servingLabel: f.servingLabel,
				visibility: f.visibility,
				mine: f.mine,
				kcal: f.nutrients.find((n) => n.code === 'energy_kcal')?.value ?? null
			}
		];
	});
	return json({ results });
};
