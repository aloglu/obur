import { redirect } from '@sveltejs/kit';
import { body } from '#lib/server/body.ts';
import { diary } from '#lib/server/diary.ts';
import { goals } from '#lib/server/goals.ts';
import { progress } from '#lib/server/progress.ts';
import { calendarDays, monthDays, monthSummary } from '#lib/shared/calendar.ts';
import { journal } from '#lib/shared/journal.ts';
import type { PageServerLoad } from './$types';

/** Weigh-ins from the start of time, for "new lowest" and the change into the month's first week. */
const EARLIEST = '0001-01-01';

export const load: PageServerLoad = async ({ url, locals, parent }) => {
	const { today } = await parent();
	const current = today.slice(0, 7);
	const month = url.searchParams.get('month') ?? current;
	if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(month) || month > current) redirect(303, '/journal');
	const userId = locals.session!.userId;
	const days = monthDays(month);
	const [from, to] = [days[0], days.at(-1)!];
	const profile = await goals.profile(userId);
	const firstDayOfWeek = profile?.firstDayOfWeek ?? 1;
	const [eaten, activity, completedDays, versions, readings, firstDay, achieved] =
		await Promise.all([
			diary.dailyEnergy(userId, from, to),
			body.activityByDay(userId, from, to),
			diary.completedDays(userId, from, to),
			goals.history(userId),
			body.weights(userId, EARLIEST, to),
			diary.firstDay(userId),
			progress.sync(userId, today, locals.zone)
		]);
	const completed = new Set(completedDays);
	const calendar = calendarDays(month, today, {
		eaten: new Map(eaten.map((d) => [d.localDate, d.kcal])),
		activity: new Map(activity.map((d) => [d.localDate, d.kcal])),
		completed,
		versions
	});
	return {
		month,
		isCurrentMonth: month === current,
		firstDayOfWeek,
		calendar,
		summary: monthSummary(calendar),
		weeks: journal({
			month,
			today,
			firstDayOfWeek,
			days: calendar,
			completed,
			readings: readings.map((r) => ({ localDate: r.localDate, value: r.value })),
			versions,
			firstDay,
			achievements: achieved.list
		})
	};
};
