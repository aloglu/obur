// Progress history rules (docs/design.md, "Progress, graphs and optional encouragement", History; docs/ui.md,
// "Progress"): ranges, weigh-ins with their smoothed trend, calorie bars against each day's own budget, and averages over days
// marked complete. Unlogged days and unknown nutrients stay missing; nothing unknown becomes zero.
import { isoWeekday, targetOn, type TargetLike } from './calendar.ts';
import { addDays } from './diary-rules.ts';
import { budgetForDay, type MacroTargets } from './goals.ts';

export const HISTORY_RANGES = ['1W', '1M', '3M', '1Y', 'All'] as const;
export type HistoryRange = (typeof HISTORY_RANGES)[number];
/** All time by default (owner, 2026-10-31). */
export const DEFAULT_RANGE: HistoryRange = 'All';
/** How far back each range reaches, in calendar months (the week is 7 days). */
const RANGE_MONTHS: Record<Exclude<HistoryRange, 'All' | '1W'>, number> = {
	'1M': 1,
	'3M': 3,
	'1Y': 12
};
/** Ranges up to this many days get a bar per day; longer ones a bar per week. */
const DAILY_BARS_UP_TO = 31;
/** A weigh-in this many days after the previous one starts a dashed stretch of the line. */
const GAP_DAYS = 7;
// The weight trend is Holt's method with a damped pace (docs/feasibility.md, "Weight trend"): each day since the
// previous weigh-in moves the smoothed weight 15 % toward the reading and the pace 10 % toward the latest pace;
// across a gap the pace fades by 2 % a day, so it isn't assumed to continue at full speed.
const LEVEL_KEEP = 0.85;
const PACE_KEEP = 0.9;
const PACE_DAMP = 0.98;

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

export interface WeightPoint {
	date: string;
	/** The day's last weigh-in. */
	weight: number;
	/** The smoothed weight after this weigh-in. */
	trend: number;
	/** The smoothed pace after this weigh-in, in kg a week (negative while losing). */
	pacePerWeek: number;
	/** More than a week since the previous weigh-in: the line is dashed up to this point. */
	gapBefore: boolean;
}

/** How many days of pace a gap carries once the pace fades by `PACE_DAMP` each day. */
const dampedDays = (gap: number) => (PACE_DAMP * (1 - PACE_DAMP ** gap)) / (1 - PACE_DAMP);
const round = (n: number, places: number) => Math.round(n * 10 ** places) / 10 ** places;

/**
 * Each weigh-in day (a day with several readings uses its last) with the smoothed weight and pace after it. Feed
 * weigh-ins from before the range too, so the trend has settled by the range's first day; then keep the points
 * inside the range.
 */
export function weightHistory(readings: { localDate: string; value: number }[]): WeightPoint[] {
	const byDay = new Map<string, number>();
	for (const r of [...readings].sort((a, b) => a.localDate.localeCompare(b.localDate)))
		byDay.set(r.localDate, r.value);
	const out: WeightPoint[] = [];
	let level = 0;
	let pace = 0; // kg a day
	for (const [date, weight] of byDay) {
		const prev = out.at(-1);
		if (!prev) {
			level = weight;
			out.push({ date, weight, trend: weight, pacePerWeek: 0, gapBefore: false });
			continue;
		}
		const gap = daysBetween(prev.date, date);
		const expected = level + pace * dampedDays(gap);
		const next = expected + (1 - LEVEL_KEEP ** gap) * (weight - expected);
		const faded = PACE_DAMP ** gap * pace;
		pace = faded + (1 - PACE_KEEP ** gap) * ((next - level) / gap - faded);
		level = next;
		out.push({
			date,
			weight,
			trend: round(level, 2),
			pacePerWeek: round(pace * 7, 2),
			gapBefore: gap > GAP_DAYS
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
	/** The day's budget, or the week's average budget over its logged days (all its days when none is logged);
	 * null without a budget. */
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
		// A week's budget averages its logged days (like its calories); an unlogged day or week still has one.
		const budgets = (inBar.length ? inBar.map((d) => d.date) : dates).map(budgetOn);
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

/** A range's history as the Progress page receives it. */
export interface ProgressHistory extends History {
	range: HistoryRange;
	from: string;
	to: string;
	weight: {
		points: WeightPoint[];
		/** The trend at the last weigh-in before the range, so a change can be shown from the range's start. */
		trendBefore: number | null;
		goalKg: number | null;
	};
	/** Today's macro targets (without activity), for comparison with the averages. */
	macros: MacroTargets | null;
}
