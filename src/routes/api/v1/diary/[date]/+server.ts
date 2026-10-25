import { error, json } from '@sveltejs/kit';
import { diary, respondDiary } from '#lib/server/diary.ts';
import { dayTotals, isIsoDate } from '#lib/shared/diary-rules.ts';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = ({ params, locals }) =>
	respondDiary(async () => {
		if (!isIsoDate(params.date)) error(400, 'Invalid date');
		const entries = await diary.day(locals.session!.userId, params.date);
		return json({ entries, totals: dayTotals(entries) });
	});
