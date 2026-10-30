import { json } from '@sveltejs/kit';
import * as v from 'valibot';
import { readJson } from '#lib/server/http.ts';
import { understandEntry } from '#lib/server/typed-entry.ts';
import { DateString, Zone } from '#lib/shared/diary-input.ts';
import type { RequestHandler } from './$types';

/**
 * POST { text, date, zone }: what a typed sentence proposes (foods with candidates, amounts, units, day and meal).
 * Writes nothing; `date` is the day being viewed, used when the sentence names none.
 */
export const POST: RequestHandler = async ({ request, locals }) => {
	const body = await readJson(
		request,
		v.object({
			text: v.pipe(v.string(), v.trim(), v.minLength(1), v.maxLength(300)),
			date: DateString,
			zone: Zone
		})
	);
	return json(await understandEntry(locals.session!.userId, body.text, body.date, body.zone));
};
