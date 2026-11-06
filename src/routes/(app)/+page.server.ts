import { redirect } from '@sveltejs/kit';
import { body } from '#lib/server/body.ts';
import { diary } from '#lib/server/diary.ts';
import { goals } from '#lib/server/goals.ts';
import { budgetForDay, macroTargetsFor } from '#lib/shared/goals.ts';
import { dayTotals, isIsoDate } from '#lib/shared/diary-rules.ts';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ url, locals, parent }) => {
	const { today } = await parent();
	const requested = url.searchParams.get('date');
	if (requested !== null && (!isIsoDate(requested) || requested > today)) redirect(303, '/');
	const date = requested ?? today;
	const userId = locals.session!.userId;
	const [entries, water, recentWeights, activity, target, completed] = await Promise.all([
		diary.day(userId, date),
		body.waterDay(userId, date),
		body.recentWeights(userId, date, 7),
		body.activityDay(userId, date),
		goals.targetFor(userId, date),
		diary.completedDays(userId, date, date)
	]);
	const budget = budgetForDay(target, activity.countedKcal);
	const macros = budget && target ? macroTargetsFor(budget.budget, target) : null;
	return {
		date,
		entries,
		totals: dayTotals(entries),
		water,
		recentWeights,
		activity,
		target,
		budget,
		macros,
		complete: completed.length > 0
	};
};
