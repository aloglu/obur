import { error, json } from '@sveltejs/kit';
import * as v from 'valibot';
import { diary } from '#lib/server/diary.ts';
import { readJson } from '#lib/server/http.ts';
import { isIsoDate } from '#lib/shared/diary-rules.ts';
import type { RequestHandler } from './$types';

/** Marks a day complete or not complete. */
export const PUT: RequestHandler = async ({ params, request, locals }) => {
	if (!isIsoDate(params.date)) error(400, 'Invalid date');
	const { complete } = await readJson(request, v.object({ complete: v.boolean() }));
	await diary.setDayComplete(locals.session!.userId, params.date, complete);
	return json({ complete });
};
