// Progress history rules (docs/design.md, "Progress, graphs and optional encouragement", History; docs/ui.md,
// "Progress"): ranges, the smoothed weight trend, calorie bars against each day's own budget, and averages over days
// marked complete. Unlogged days and unknown nutrients stay missing; nothing unknown becomes zero.
import { isoWeekday, targetOn, type TargetLike } from './calendar.ts';
import { addDays } from './diary-rules.ts';
import { budgetForDay } from './goals.ts';

export const HISTORY_RANGES = ['1W', '1M', '3M', '1Y', 'All'] as const;
export type HistoryRange = (typeof HISTORY_RANGES)[number];
export const DEFAULT_RANGE: HistoryRange = '3M';
/** How far back each range reaches, in calendar months (the week is 7 days). */
const RANGE_MONTHS: Record<Exclude<HistoryRange, 'All' | '1W'>, number> = {
	'1M': 1,
	'3M': 3,
	'1Y': 12
};
/** Ranges up to this many days get a bar per day; longer ones a bar per week. */
const DAILY_BARS_UP_TO = 31;
/** A weigh-in this many days after the previous one starts a dashed stretch of the trend. */
const TREND_GAP_DAYS = 7;
/** Each day since the previous weigh-in moves the trend 10 % of the way toward the new reading. */
const TREND_DAILY_KEEP = 0.9;

export const isHistoryRange = (value: string | null): value is HistoryRange =>
	(HISTORY_RANGES as readonly string[]).includes(value ?? '');

/**
 * The first day shown: the day after the same date n months back (clamped to the month's end), so 3 months to
 * 31 October starts on 1 August. `All` starts at the earliest record (`first`), never after today.
 */
export function rangeStart(range: HistoryRange, today: string, first: string | null): string {
	if (range === 'All') return first && first < today ? first : today;
	if (range === '1W') return addDays(today, -6);
	const [y, m, d] = today.split('-').map(Number);
	const months = y * 12 + (m - 1) - RANGE_MONTHS[range];
	const year = Math.floor(months / 12);
	const month = (months % 12) + 1;
	const lastDay = new Date(Date.UTC(year, month, 0)).getUTCDate();
	const back = `${year}-${String(month).padStart(2, '0')}-${String(Math.min(d, lastDay)).padStart(2, '0')}`;
	return addDays(back, 1);
}

const daysBetween = (from: string, to: string) =>
	Math.round((Date.parse(`${to}T12:00:00Z`) - Date.parse(`${from}T12:00:00Z`)) / 86_400_000);

export interface TrendPoint {
	date: string;
	/** The day's last weigh-in. */
	weight: number;
	trend: number;
	/** More than a week since the previous weigh-in: the trend line is dashed up to this point. */
	gapBefore: boolean;
}

/**
 * The smoothed weight trend at each weigh-in day (a day with several readings uses its last). Feed readings from
 * before the range too, so the trend is settled by its first day; then keep the points inside the range.
 */
export function weightTrend(readings: { localDate: string; value: number }[]): TrendPoint[] {
	const byDay = new Map<string, number>();
	for (const r of [...readings].sort((a, b) => a.localDate.localeCompare(b.localDate)))
		byDay.set(r.localDate, r.value);
	const out: TrendPoint[] = [];
	for (const [date, weight] of byDay) {
		const prev = out.at(-1);
		if (!prev) {
			out.push({ date, weight, trend: weight, gapBefore: false });
			continue;
		}
		const gap = daysBetween(prev.date, date);
		const trend = prev.trend + (1 - TREND_DAILY_KEEP ** gap) * (weight - prev.trend);
		out.push({
			date,
			weight,
			trend: Math.round(trend * 100) / 100,
			gapBefore: gap > TREND_GAP_DAYS
		});
	}
	return out;
}

/** A nutrient's total for one day: known only when every entry of the day states it. */
export interface DayNutrient {
	value: number;
	/** Entries of the day that don't state it (for carbohydrate: no value with a stated definition). */
	missing: number;
}

export interface HistoryDay {
	date: string;
	eatenKcal: number;
	complete: boolean;
	protein: DayNutrient;
	carbohydrate: DayNutrient;
	fat: DayNutrient;
}

export interface HistoryInput {
	from: string;
	to: string;
	/** Logged days only; a day that isn't here was not logged. */
	days: HistoryDay[];
	versions: TargetLike[];
	/** Counted activity per day. */
	activity: Map<string, number>;
	/** Water per day in ml, for days with water recorded. */
	water: Map<string, number>;
	weighIns: number;
	firstDayOfWeek: number;
}

export interface CalorieBar {
	from: string;
	to: string;
	/** A day's total, or a week's average over its logged days; null when nothing was logged. */
	eatenKcal: number | null;
	/** The day's budget, or the week's average budget over its logged days; null without a budget. */
	budgetKcal: number | null;
	/** Daily bars: marked complete. Weekly bars: every logged day marked complete. */
	complete: boolean;
	loggedDays: number;
	days: number;
}

export interface Average {
	value: number | null;
	/** How many days it is based on. */
	days: number;
}

export interface HistoryAverages {
	/** Days logged and marked complete: the days the averages count. */
	completeDays: number;
	eatenKcal: Average;
	/** Eaten minus budget, over complete days that have a budget. */
	againstBudget: Average;
	overBudgetDays: number;
	protein: Average;
	carbohydrate: Average;
	fat: Average;
	/** Over days with water recorded, complete or not. */
	waterMl: Average;
	weighIns: number;
}

export interface History {
	bars: CalorieBar[];
	weekly: boolean;
	averages: HistoryAverages;
}

const mean = (values: number[]): number | null =>
	values.length ? values.reduce((s, v) => s + v, 0) / values.length : null;
const average = (values: number[]): Average => ({ value: mean(values), days: values.length });

export function history(input: HistoryInput): History {
	const logged = new Map(input.days.map((d) => [d.date, d]));
	const budgetOn = (date: string) =>
		budgetForDay(targetOn(input.versions, date), input.activity.get(date) ?? 0)?.budget ?? null;

	const span: string[] = [];
	for (let d = input.from; d <= input.to; d = addDays(d, 1)) span.push(d);
	const weekly = span.length > DAILY_BARS_UP_TO;

	const groups: string[][] = [];
	for (const date of span) {
		const startsWeek = (isoWeekday(date) - input.firstDayOfWeek + 7) % 7 === 0;
		if (!weekly || groups.length === 0 || startsWeek) groups.push([date]);
		else groups.at(-1)!.push(date);
	}
	const bars = groups.map((dates): CalorieBar => {
		const inBar = dates.flatMap((date) => (logged.has(date) ? [logged.get(date)!] : []));
		const budgets = inBar.map((d) => budgetOn(d.date));
		return {
			from: dates[0],
			to: dates.at(-1)!,
			eatenKcal: mean(inBar.map((d) => d.eatenKcal)),
			budgetKcal: budgets.some((b) => b === null) ? null : mean(budgets as number[]),
			complete: inBar.length > 0 && inBar.every((d) => d.complete),
			loggedDays: inBar.length,
			days: dates.length
		};
	});

	const counted = span.flatMap((date) => {
		const d = logged.get(date);
		return d?.complete ? [{ ...d, budget: budgetOn(date) }] : [];
	});
	const withBudget = counted.filter((d) => d.budget !== null);
	const known = (key: 'protein' | 'carbohydrate' | 'fat') =>
		average(counted.filter((d) => d[key].missing === 0).map((d) => d[key].value));
	const water = span.flatMap((date) => (input.water.has(date) ? [input.water.get(date)!] : []));
	return {
		bars,
		weekly,
		averages: {
			completeDays: counted.length,
			eatenKcal: average(counted.map((d) => d.eatenKcal)),
			againstBudget: average(withBudget.map((d) => d.eatenKcal - d.budget!)),
			overBudgetDays: withBudget.filter((d) => d.eatenKcal > d.budget!).length,
			protein: known('protein'),
			carbohydrate: known('carbohydrate'),
			fat: known('fat'),
			waterMl: average(water),
			weighIns: input.weighIns
		}
	};
}
