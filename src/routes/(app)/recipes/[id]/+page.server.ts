import { error } from '@sveltejs/kit';
import * as v from 'valibot';
import { catalog, recipes } from '#lib/server/catalog.ts';
import { anyValuesChanged } from '#lib/shared/diary-rules.ts';
import { CatalogError } from '#lib/server/modules/catalog/index.ts';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ params, locals }) => {
	if (!v.safeParse(v.pipe(v.string(), v.uuid()), params.id).success) error(404, 'Not found');
	try {
		const userId = locals.session!.userId;
		const recipe = await recipes.get(userId, params.id);
		const ids = recipe.ingredients.flatMap((i) => (i.foodId ? [i.foodId] : []));
		return {
			recipe,
			stale: anyValuesChanged(recipe.ingredients, await catalog.foodsById(userId, ids))
		};
	} catch (e) {
		if (e instanceof CatalogError && e.code === 'not_found') error(404, 'Not found');
		throw e;
	}
};
