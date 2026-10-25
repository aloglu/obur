// The application's catalog instance and its HTTP error mapping.
import { json } from '@sveltejs/kit';
import { CatalogError, createCatalog } from '#lib/server/modules/catalog/index.ts';
import { db } from './db/index.ts';

export const catalog = createCatalog(db);

const STATUS = { not_found: 404, forbidden: 403, conflict: 409, energy_required: 422 } as const;

export async function respondCatalog(run: () => Promise<Response>): Promise<Response> {
	try {
		return await run();
	} catch (e) {
		if (e instanceof CatalogError) return json({ error: e.code }, { status: STATUS[e.code] });
		throw e;
	}
}
