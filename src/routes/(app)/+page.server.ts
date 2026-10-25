import { redirect } from '@sveltejs/kit';
import { body } from '#lib/server/body.ts';
import { diary } from '#lib/server/diary.ts';
import { dayTotals, isIsoDate } from '#lib/shared/diary-rules.ts';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ url, locals, parent }) => {
	const { today } = await parent();
	const requested = url.searchParams.get('date');
	if (requested !== null && (!isIsoDate(requested) || requested > today)) redirect(303, '/');
	const date = requested ?? today;
	const userId = locals.session!.userId;
	const [entries, water, latestWeight] = await Promise.all([
		diary.day(userId, date),
		body.waterDay(userId, date),
		body.latestWeight(userId, date)
	]);
	return { date, entries, totals: dayTotals(entries), water, latestWeight };
};
