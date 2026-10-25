import { error, json } from '@sveltejs/kit';
import * as v from 'valibot';
import { catalog } from '#lib/server/catalog.ts';
import { diary, respondDiary } from '#lib/server/diary.ts';
import { readJson } from '#lib/server/http.ts';
import { resolveUnit } from '#lib/server/modules/diary/index.ts';
import { UpdateEntry } from '#lib/shared/diary-input.ts';
import type { RequestHandler } from './$types';

const entryId = (raw: string) => {
	if (!v.safeParse(v.pipe(v.string(), v.uuid()), raw).success) error(404, 'Not found');
	return raw;
};

export const PATCH: RequestHandler = ({ params, request, locals }) =>
	respondDiary(async () => {
		const userId = locals.session!.userId;
		const id = entryId(params.id);
		const body = await readJson(request, UpdateEntry);
		let unit;
		if (body.unit) {
			// Units resolve against the entry's own snapshot, not the current catalog.
			const entry = await diary.get(userId, id);
			unit = resolveUnit(body.unit, entry.food?.servings ?? [], await catalog.householdMeasures());
			if (!unit) error(422, 'Unknown unit for this entry');
		}
		return json(
			await diary.update(userId, id, body.revision, {
				amount: body.amount,
				unit,
				kcal: body.kcal,
				description: body.description,
				meal: body.meal,
				localDate: body.date
			})
		);
	});

/** Trash actions: ?action=delete moves to the trash, ?action=restore brings it back. */
export const POST: RequestHandler = ({ params, url, locals }) =>
	respondDiary(async () => {
		const userId = locals.session!.userId;
		const id = entryId(params.id);
		const action = url.searchParams.get('action');
		if (action === 'delete') return json(await diary.remove(userId, id));
		if (action === 'restore') return json(await diary.restore(userId, id));
		error(400, 'Unknown action');
	});
