import { redirect } from '@sveltejs/kit';
import { goals } from '#lib/server/goals.ts';
import { progress } from '#lib/server/progress.ts';
import { loadHistory } from '#lib/server/progress-history.ts';
import { DEFAULT_RANGE, isHistoryRange } from '#lib/shared/history.ts';
import { localDate } from '#lib/shared/diary-rules.ts';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ url, locals }) => {
	// Worked out here rather than taken from the layout: the layout's data refreshes on its own, and a page that
	// read it would be loaded again with it.
	const today = localDate(new Date(), locals.zone);
	// The calendar moved to the Journal (docs/ui.md); an old link with a month opens it there.
	const month = url.searchParams.get('month');
	if (month !== null) redirect(303, `/journal?month=${encodeURIComponent(month)}`);
	const rangeParam = url.searchParams.get('range');
	if (rangeParam !== null && !isHistoryRange(rangeParam)) redirect(303, '/progress');
	const range = rangeParam ?? DEFAULT_RANGE;
	const userId = locals.session!.userId;
	const profile = await goals.profile(userId);
	const firstDayOfWeek = profile?.firstDayOfWeek ?? 1;
	const [history, achieved] = await Promise.all([
		loadHistory(userId, range, today, firstDayOfWeek),
		progress.sync(userId, today, locals.zone)
	]);
	return { history, achievements: achieved.list.length };
};
