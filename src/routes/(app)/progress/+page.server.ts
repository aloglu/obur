import { redirect } from '@sveltejs/kit';
import { body } from '#lib/server/body.ts';
import { diary } from '#lib/server/diary.ts';
import { goals } from '#lib/server/goals.ts';
import { loadHistory } from '#lib/server/progress-history.ts';
import { calendarDays, monthDays, monthSummary } from '#lib/shared/calendar.ts';
import { DEFAULT_RANGE, isHistoryRange } from '#lib/shared/history.ts';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ url, locals, parent }) => {
	const { today } = await parent();
	const current = today.slice(0, 7);
	const month = url.searchParams.get('month') ?? current;
	if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(month) || month > current) redirect(303, '/progress');
	const rangeParam = url.searchParams.get('range');
	if (rangeParam !== null && !isHistoryRange(rangeParam)) redirect(303, '/progress');
	const range = rangeParam ?? DEFAULT_RANGE;
	const userId = locals.session!.userId;
	const days = monthDays(month);
	const [from, to] = [days[0], days.at(-1)!];
	const profile = await goals.profile(userId);
	const firstDayOfWeek = profile?.firstDayOfWeek ?? 1;
	const [eaten, activity, completed, versions, history] = await Promise.all([
		diary.dailyEnergy(userId, from, to),
		body.activityByDay(userId, from, to),
		diary.completedDays(userId, from, to),
		goals.history(userId),
		loadHistory(userId, range, today, firstDayOfWeek)
	]);
	const calendar = calendarDays(month, today, {
		eaten: new Map(eaten.map((d) => [d.localDate, d.kcal])),
		activity: new Map(activity.map((d) => [d.localDate, d.kcal])),
		completed: new Set(completed),
		versions
	});
	return {
		month,
		isCurrentMonth: month === current,
		firstDayOfWeek,
		calendar,
		summary: monthSummary(calendar),
		history
	};
};
