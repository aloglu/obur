import { redirect } from '@sveltejs/kit';
import { body } from '#lib/server/body.ts';
import { diary } from '#lib/server/diary.ts';
import { goals } from '#lib/server/goals.ts';
import { progress } from '#lib/server/progress.ts';
import { calendarDays, monthDays } from '#lib/shared/calendar.ts';
import { journal } from '#lib/shared/journal.ts';
import { isIsoDate, localDate } from '#lib/shared/diary-rules.ts';
import type { PageServerLoad } from './$types';

/** Weigh-ins from the start of time, for "new lowest" and the change into the month's first week. */
const EARLIEST = '0001-01-01';

export const load: PageServerLoad = async ({ url, locals }) => {
	// Worked out here rather than taken from the layout: the layout's data refreshes on its own, and a page that
	// read it would be loaded again with it.
	const today = localDate(new Date(), locals.zone);
	const current = today.slice(0, 7);
	// Coming from a past day on Today: its month, with that day picked.
	const dayParam = url.searchParams.get('day');
	const day = dayParam && isIsoDate(dayParam) && dayParam <= today ? dayParam : null;
	const month = url.searchParams.get('month') ?? day?.slice(0, 7) ?? current;
	if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(month) || month > current) redirect(303, '/journal');
	const userId = locals.session!.userId;
	const days = monthDays(month);
	const [from, to] = [days[0], days.at(-1)!];
	const profile = await goals.profile(userId);
	const firstDayOfWeek = profile?.firstDayOfWeek ?? 1;
	const [eaten, activity, completedDays, versions, readings, achieved] = await Promise.all([
		diary.dailyEnergy(userId, from, to),
		body.activityByDay(userId, from, to),
		diary.completedDays(userId, from, to),
		goals.history(userId),
		body.weights(userId, EARLIEST, to),
		progress.sync(userId, today, locals.zone)
	]);
	const completed = new Set(completedDays);
	const calendar = calendarDays(month, today, {
		eaten: new Map(eaten.map((d) => [d.localDate, d.kcal])),
		activity: new Map(activity.map((d) => [d.localDate, d.kcal])),
		completed,
		versions
	});
	// The last weigh-in of each day this month (readings come oldest first).
	const dayWeights: Record<string, number> = {};
	for (const r of readings) if (r.localDate.startsWith(month)) dayWeights[r.localDate] = r.value;
	const lastLogged = calendar.findLast((d) => d.status !== 'unlogged' && d.status !== 'future');
	const selectedDay =
		day?.startsWith(month) === true
			? day
			: month === current
				? today
				: (lastLogged?.date ?? calendar[0].date);
	return {
		month,
		isCurrentMonth: month === current,
		firstDayOfWeek,
		calendar,
		dayWeights,
		selectedDay,
		weeks: journal({
			month,
			today,
			firstDayOfWeek,
			days: calendar,
			completed,
			readings: readings.map((r) => ({ localDate: r.localDate, value: r.value })),
			versions,
			achievements: achieved.list
		})
	};
};
