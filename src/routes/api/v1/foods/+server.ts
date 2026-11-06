import { json } from '@sveltejs/kit';
import * as v from 'valibot';
import { catalog, respondCatalog } from '#lib/server/catalog.ts';
import { diary } from '#lib/server/diary.ts';
import { readJson } from '#lib/server/http.ts';
import { FoodInput } from '#lib/shared/food-input.ts';
import { ScanEditsInput } from '#lib/shared/scan-edits.ts';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = ({ url, locals }) =>
	respondCatalog(async () => {
		const userId = locals.session!.userId;
		if (url.searchParams.get('mine') !== null) {
			const offset = Number(url.searchParams.get('offset') ?? 0);
			return json(await catalog.ownFoods(userId, Number.isInteger(offset) ? offset : 0));
		}
		const q = (url.searchParams.get('q') ?? '').slice(0, 200);
		const recent = await diary.recentFoodIds(userId, 20);
		return json({ results: await catalog.searchFoods(userId, q, 20, recent) });
	});

export const POST: RequestHandler = ({ request, locals }) =>
	respondCatalog(async () => {
		// A food confirmed from a label scan records that it came from one, and how much the proposal was edited
		// (counts only); anything else is hand-made.
		const body = await readJson(
			request,
			v.object({
				food: FoodInput,
				source: v.optional(v.picklist(['manual', 'label_scan'])),
				scanEdits: v.optional(ScanEditsInput)
			})
		);
		return json(
			{
				id: await catalog.createFood(locals.session!.userId, body.food, {
					origin: body.source ?? 'manual',
					scanEdits: body.scanEdits
				})
			},
			{ status: 201 }
		);
	});
