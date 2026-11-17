import { json } from '@sveltejs/kit';
import { recipes, respondCatalog } from '#lib/server/catalog.ts';
import type { RequestHandler } from './$types';

/** The person's recipes, in use and archived (Archived recipes reads it again after a change). */
export const GET: RequestHandler = ({ locals }) =>
	respondCatalog(async () => json({ recipes: await recipes.list(locals.session!.userId) }));
