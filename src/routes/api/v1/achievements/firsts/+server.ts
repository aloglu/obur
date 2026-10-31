import { json } from '@sveltejs/kit';
import * as v from 'valibot';
import { readJson } from '#lib/server/http.ts';
import { progress } from '#lib/server/progress.ts';
import { localDate } from '#lib/shared/diary-rules.ts';
import type { RequestHandler } from './$types';

const FirstInput = v.object({ first: v.picklist(['voice']) });

/** POST a first that has no record behind it (the first voice log), on the person's today; once only. */
export const POST: RequestHandler = async ({ request, locals }) => {
	const { first } = await readJson(request, FirstInput);
	await progress.recordFirst(locals.session!.userId, first, localDate(new Date(), locals.zone));
	return json({ ok: true });
};
