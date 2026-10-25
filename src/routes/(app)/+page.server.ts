import { redirect } from '@sveltejs/kit';
import { body } from '#lib/server/body.ts';
import { diary } from '#lib/server/diary.ts';
import { goals } from '#lib/server/goals.ts';
import { budgetForDay, macroTargets } from '#lib/shared/goals.ts';
import { dayTotals, isIsoDate } from '#lib/shared/diary-rules.ts';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ url, locals, parent }) => {
	const { today } = await parent();
	const requested = url.searchParams.get('date');
	if (requested !== null && (!isIsoDate(requested) || requested > today)) redirect(303, '/');
	const date = requested ?? today;
	const userId = locals.session!.userId;
	const [entries, water, latestWeight, activity, target, completed] = await Promise.all([
		diary.day(userId, date),
		body.waterDay(userId, date),
		body.latestWeight(userId, date),
		body.activityDay(userId, date),
		goals.targetFor(userId, date),
		diary.completedDays(userId, date, date)
	]);
	const budget = budgetForDay(target, activity.countedKcal);
	// Macro targets come only from calculated targets (protein from body weight, fat share, carbohydrate the rest).
	const macros =
		budget &&
		target?.mode === 'calculated' &&
		target.proteinGPerKg &&
		target.proteinBasisKg &&
		target.fatShare
			? macroTargets(budget.budget, {
					proteinGPerKg: target.proteinGPerKg,
					proteinBasisKg: target.proteinBasisKg,
					fatShare: target.fatShare
				})
			: null;
	return {
		date,
		entries,
		totals: dayTotals(entries),
		water,
		latestWeight,
		activity,
		target,
		budget,
		macros,
		complete: completed.length > 0
	};
};
