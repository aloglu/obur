// The application's catalog instance and its HTTP error mapping.
import { json } from '@sveltejs/kit';
import { CatalogError, createCatalog, createRecipes } from '#lib/server/modules/catalog/index.ts';
import { db } from './db/index.ts';

export const catalog = createCatalog(db);
export const recipes = createRecipes(db);

const STATUS = {
	not_found: 404,
	forbidden: 403,
	conflict: 409,
	energy_required: 422,
	conversion_unknown: 422
} as const;

export async function respondCatalog(run: () => Promise<Response>): Promise<Response> {
	try {
		return await run();
	} catch (e) {
		if (e instanceof CatalogError) return json({ error: e.code }, { status: STATUS[e.code] });
		throw e;
	}
}
