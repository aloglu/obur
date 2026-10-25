import { error, json } from '@sveltejs/kit';
import * as v from 'valibot';
import { catalog, respondCatalog } from '#lib/server/catalog.ts';
import { readJson } from '#lib/server/http.ts';
import { FoodInput } from '#lib/shared/food-input.ts';
import type { RequestHandler } from './$types';

const id = (raw: string) => {
	const parsed = v.safeParse(v.pipe(v.string(), v.uuid()), raw);
	if (!parsed.success) error(404, 'Not found');
	return parsed.output;
};

export const GET: RequestHandler = ({ params, locals }) =>
	respondCatalog(async () => json(await catalog.getFood(locals.session!.userId, id(params.id))));

export const PUT: RequestHandler = ({ params, request, locals }) =>
	respondCatalog(async () => {
		const body = await readJson(
			request,
			v.object({ version: v.pipe(v.number(), v.integer(), v.minValue(1)), food: FoodInput })
		);
		const version = await catalog.updateFood(
			locals.session!.userId,
			id(params.id),
			body.version,
			body.food
		);
		return json({ version });
	});

/** Actions on one food: archive/restore and "Make my own variant". */
export const POST: RequestHandler = ({ params, request, locals, url }) =>
	respondCatalog(async () => {
		const userId = locals.session!.userId;
		const action = url.searchParams.get('action');
		if (action === 'archive' || action === 'restore') {
			await catalog.setArchived(userId, id(params.id), action === 'archive');
			return json({ ok: true });
		}
		if (action === 'variant') {
			await readJson(request, v.object({}));
			return json({ id: await catalog.makeVariant(userId, id(params.id)) }, { status: 201 });
		}
		error(400, 'Unknown action');
	});
