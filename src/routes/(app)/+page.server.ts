import { redirect } from '@sveltejs/kit';
import { diary } from '#lib/server/diary.ts';
import { dayTotals, isIsoDate } from '#lib/shared/diary-rules.ts';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ url, locals, parent }) => {
	const { today } = await parent();
	const requested = url.searchParams.get('date');
	if (requested !== null && (!isIsoDate(requested) || requested > today)) redirect(303, '/');
	const date = requested ?? today;
	const entries = await diary.day(locals.session!.userId, date);
	return { date, entries, totals: dayTotals(entries) };
};
