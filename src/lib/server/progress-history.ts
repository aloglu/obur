// The Progress history for a range (docs/ui.md, "Progress"): the person's logged days, budgets, water and weigh-ins
// from the diary, body and goals modules, shaped by the pure rules in shared/history.ts.
import { targetOn } from '#lib/shared/calendar.ts';
import { addDays } from '#lib/shared/diary-rules.ts';
import { budgetForDay, macroTargetsFor, type MacroTargets } from '#lib/shared/goals.ts';
import {
	history,
	rangeStart,
	weightTrend,
	type History,
	type HistoryRange,
	type TrendPoint
} from '#lib/shared/history.ts';
import { body } from './body.ts';
import { diary } from './diary.ts';
import { goals } from './goals.ts';

/** Weigh-ins this far before the range settle the trend by its first day. */
const TREND_LEAD_DAYS = 60;

export interface ProgressHistory extends History {
	range: HistoryRange;
	from: string;
	to: string;
	weight: {
		points: TrendPoint[];
		/** The trend at the last weigh-in before the range, so a change can be shown from the range's start. */
		trendBefore: number | null;
		goalKg: number | null;
	};
	/** Today's macro targets (without activity), for comparison with the averages. */
	macros: MacroTargets | null;
}

export async function loadHistory(
	userId: string,
	range: HistoryRange,
	today: string,
	firstDayOfWeek: number
): Promise<ProgressHistory> {
	let first: string | null = null;
	if (range === 'All') {
		const firsts = (
			await Promise.all([diary.firstDay(userId), body.firstWeightDay(userId)])
		).filter((d): d is string => d !== null);
		first = firsts.sort()[0] ?? null;
	}
	const from = rangeStart(range, today, first);
	const [days, completed, activity, water, versions, readings] = await Promise.all([
		diary.dailyHistory(userId, from, today),
		diary.completedDays(userId, from, today),
		body.activityByDay(userId, from, today),
		body.waterByDay(userId, from, today),
		goals.history(userId),
		body.weights(userId, addDays(from, -TREND_LEAD_DAYS), today)
	]);
	const done = new Set(completed);
	const shaped = history({
		from,
		to: today,
		days: days.map((d) => ({
			date: d.localDate,
			eatenKcal: d.kcal,
			complete: done.has(d.localDate),
			protein: d.protein,
			carbohydrate: d.carbohydrate,
			fat: d.fat
		})),
		versions,
		activity: new Map(activity.map((a) => [a.localDate, a.kcal])),
		water: new Map(water.map((w) => [w.localDate, w.ml])),
		weighIns: readings.filter((r) => r.localDate >= from).length,
		firstDayOfWeek
	});
	const trend = weightTrend(readings);
	const current = targetOn(versions, today);
	const budget = budgetForDay(current, 0);
	return {
		...shaped,
		range,
		from,
		to: today,
		weight: {
			points: trend.filter((p) => p.date >= from),
			trendBefore: trend.filter((p) => p.date < from).at(-1)?.trend ?? null,
			goalKg: current?.goalWeightKg ?? null
		},
		macros: budget && current ? macroTargetsFor(budget.budget, current) : null
	};
}
