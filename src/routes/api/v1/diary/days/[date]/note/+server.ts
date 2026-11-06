import { error, json } from '@sveltejs/kit';
import * as v from 'valibot';
import { diary } from '#lib/server/diary.ts';
import { readJson } from '#lib/server/http.ts';
import { isIsoDate } from '#lib/shared/diary-rules.ts';
import type { RequestHandler } from './$types';

const Body = v.object({
	// The offline queue identifies what it sends; the note itself is one per day.
	id: v.pipe(v.string(), v.uuid()),
	text: v.pipe(v.string(), v.maxLength(10_000)),
	typedAt: v.pipe(v.string(), v.isoTimestamp())
});

/** Saves the day's note, unless a later-typed version is already here (docs/design.md, "Day notes"). */
export const POST: RequestHandler = async ({ params, request, locals }) => {
	if (!isIsoDate(params.date)) error(400, 'Invalid date');
	const { text, typedAt } = await readJson(request, Body);
	return json(
		await diary.saveDayNote(locals.session!.userId, params.date, text, new Date(typedAt))
	);
};
