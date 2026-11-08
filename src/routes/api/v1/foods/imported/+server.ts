import { json } from '@sveltejs/kit';
import * as v from 'valibot';
import { catalog, respondCatalog } from '#lib/server/catalog.ts';
import { readJson } from '#lib/server/http.ts';
import type { RequestHandler } from './$types';

/** How many of the person's foods came from LoseIt, in use and archived. */
export const GET: RequestHandler = ({ locals }) =>
	respondCatalog(async () => json(await catalog.importedFoods(locals.session!.userId)));

/** Archives, or brings back, every food the person imported from LoseIt. */
export const POST: RequestHandler = ({ request, locals }) =>
	respondCatalog(async () => {
		const { archived } = await readJson(request, v.object({ archived: v.boolean() }));
		const changed = await catalog.setImportedArchived(locals.session!.userId, archived);
		return json({ changed });
	});
