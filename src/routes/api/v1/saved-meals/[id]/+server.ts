import { error, json } from '@sveltejs/kit';
import * as v from 'valibot';
import { catalog } from '#lib/server/catalog.ts';
import { respondDiary, savedMeals } from '#lib/server/diary.ts';
import { readJson } from '#lib/server/http.ts';
import { resolveUnit, type MealItemEdit } from '#lib/server/modules/diary/index.ts';
import { RenameSavedMeal, SaveSavedMeal } from '#lib/shared/diary-input.ts';
import type { RequestHandler } from './$types';

const validId = (id: string) => {
	if (!v.safeParse(v.pipe(v.string(), v.uuid()), id).success) error(404, 'Not found');
	return id;
};

export const GET: RequestHandler = ({ params, locals }) =>
	respondDiary(async () => json(await savedMeals.get(locals.session!.userId, validId(params.id))));

/** PATCH { revision, name }: renames; a stale revision gets 409. */
export const PATCH: RequestHandler = ({ params, request, locals }) =>
	respondDiary(async () => {
		const id = validId(params.id);
		const body = await readJson(request, RenameSavedMeal);
		return json(await savedMeals.rename(locals.session!.userId, id, body.revision, body.name));
	});

/**
 * PUT { revision | null, name, items }: the editor's save. Creates the meal (revision null) or replaces its name and
 * contents. Units resolve against each kept item's own snapshot, or a new food as the person can see it now.
 */
export const PUT: RequestHandler = ({ params, request, locals }) =>
	respondDiary(async () => {
		const id = validId(params.id);
		const userId = locals.session!.userId;
		const body = await readJson(request, SaveSavedMeal);
		const kept =
			body.revision === null
				? new Map()
				: new Map((await savedMeals.get(userId, id)).items.map((i) => [i.id, i]));
		const foodIds = [...new Set(body.items.flatMap((i) => ('foodId' in i ? [i.foodId] : [])))];
		const foods = new Map((await catalog.foodsById(userId, foodIds)).map((f) => [f.id, f]));
		const measures = await catalog.householdMeasures();
		const items = body.items.map((item): MealItemEdit => {
			if ('foodId' in item) {
				const food = foods.get(item.foodId);
				if (!food) error(404, 'Not found');
				const unit = resolveUnit(item.unit, food.servings, measures);
				if (!unit) error(422, 'Unknown unit for this food');
				return { food, amount: item.amount, unit };
			}
			if (!item.unit) return { itemId: item.itemId, amount: item.amount };
			const unit = resolveUnit(item.unit, kept.get(item.itemId)?.food?.servings ?? [], measures);
			if (!unit) error(422, 'Unknown unit for this food');
			return { itemId: item.itemId, amount: item.amount, unit };
		});
		return json(
			await savedMeals.saveContents(userId, {
				id,
				revision: body.revision,
				name: body.name,
				items
			})
		);
	});

/** Deletes the saved meal; entries logged from it stay. */
export const DELETE: RequestHandler = ({ params, locals }) =>
	respondDiary(async () => {
		await savedMeals.remove(locals.session!.userId, validId(params.id));
		return json({ ok: true });
	});
