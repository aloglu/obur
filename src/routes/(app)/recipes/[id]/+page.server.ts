import { error } from '@sveltejs/kit';
import * as v from 'valibot';
import { recipes } from '#lib/server/catalog.ts';
import { CatalogError } from '#lib/server/modules/catalog/index.ts';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ params, locals }) => {
	if (!v.safeParse(v.pipe(v.string(), v.uuid()), params.id).success) error(404, 'Not found');
	try {
		return { recipe: await recipes.get(locals.session!.userId, params.id) };
	} catch (e) {
		if (e instanceof CatalogError && e.code === 'not_found') error(404, 'Not found');
		throw e;
	}
};
