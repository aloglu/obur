import { json } from '@sveltejs/kit';
import * as v from 'valibot';
import { catalog, respondCatalog } from '#lib/server/catalog.ts';
import { readJson } from '#lib/server/http.ts';
import { MAX_BULK_FOODS } from '#lib/server/modules/catalog/index.ts';
import type { RequestHandler } from './$types';

/**
 * POST { action, ids } or { action, all: 'food' | 'recipe' }: archives, restores, deletes or brings back the person's
 * foods or recipes in one step, all or none (docs/design.md, "Archived and deleted foods"). `all` is Select all on the
 * archive. Answers with the IDs changed, which undo the step with the opposite action, and for a delete the recipes
 * that used them.
 */
export const POST: RequestHandler = ({ request, locals }) =>
	respondCatalog(async () => {
		const action = v.picklist(['archive', 'restore', 'delete', 'undelete']);
		const body = await readJson(
			request,
			v.union([
				v.object({
					action,
					ids: v.pipe(
						v.array(v.pipe(v.string(), v.uuid())),
						v.minLength(1),
						v.maxLength(MAX_BULK_FOODS)
					)
				}),
				v.object({ action, all: v.picklist(['food', 'recipe']) })
			])
		);
		return json(
			await catalog.bulk(
				locals.session!.userId,
				body.action,
				'ids' in body ? { ids: body.ids } : { all: body.all }
			)
		);
	});
