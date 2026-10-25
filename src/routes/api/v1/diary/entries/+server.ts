import { error, json } from '@sveltejs/kit';
import { catalog, respondCatalog } from '#lib/server/catalog.ts';
import { diary, respondDiary } from '#lib/server/diary.ts';
import { readJson } from '#lib/server/http.ts';
import { resolveUnit } from '#lib/server/modules/diary/index.ts';
import { CreateEntry } from '#lib/shared/diary-input.ts';
import type { RequestHandler } from './$types';

export const POST: RequestHandler = ({ request, locals }) =>
	respondCatalog(() =>
		respondDiary(async () => {
			const userId = locals.session!.userId;
			const body = await readJson(request, CreateEntry);
			const ctx = { id: body.id, localDate: body.date, meal: body.meal, zone: body.zone };
			if (body.kind === 'quick') {
				return json(await diary.quickAdd(userId, ctx, body.kcal, body.description), {
					status: 201
				});
			}
			// The food must be visible to this person (RLS); its snapshot is taken here, on the server.
			const food = await catalog.getFood(userId, body.foodId);
			const unit = resolveUnit(body.unit, food.servings, await catalog.householdMeasures());
			if (!unit) error(422, 'Unknown unit for this food');
			return json(await diary.logFood(userId, ctx, food, body.amount, unit), { status: 201 });
		})
	);
