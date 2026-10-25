// Month calendar rules (docs/ui.md "Progress"; docs/design.md "Progress, graphs and optional encouragement").
// Missing days are unlogged, not zero; only complete days at or under budget count as "under".
import { budgetForDay } from './goals.ts';

export type DayStatus =
	/** After today: no ring, not selectable. */
	| 'future'
	/** Nothing logged. */
	| 'unlogged'
	/** Logged, but no budget applies. */
	| 'no_budget'
	/** Logged and at or under budget, but not marked complete: neutral. */
	| 'incomplete'
	/** Marked complete and at or under budget: green. */
	| 'under'
	/** Over budget (complete or not): full red ring. */
	| 'over';

export interface CalendarDay {
	date: string;
	status: DayStatus;
	eatenKcal: number;
	budgetKcal: number | null;
	/** eaten ÷ budget, capped at 1. */
	fill: number;
	isToday: boolean;
}

export interface TargetLike {
	effectiveFrom: string;
	createdAt: string;
	mode: 'calculated' | 'manual' | 'none';
	baseBurnKcal: number | null;
	deficitKcal: number;
	floorKcal: number;
}

/** The newest version effective on or before a day (versions in any order). */
export function targetOn<T extends TargetLike>(versions: T[], date: string): T | null {
	let best: T | null = null;
	for (const v of versions) {
		if (v.effectiveFrom > date) continue;
		if (
			!best ||
			v.effectiveFrom > best.effectiveFrom ||
			(v.effectiveFrom === best.effectiveFrom && v.createdAt > best.createdAt)
		) {
			best = v;
		}
	}
	return best;
}

/** "2026-10" → its days, as YYYY-MM-DD. */
export function monthDays(month: string): string[] {
	const [y, m] = month.split('-').map(Number);
	const days = new Date(Date.UTC(y, m, 0)).getUTCDate();
	return Array.from({ length: days }, (_, i) => `${month}-${String(i + 1).padStart(2, '0')}`);
}

/** ISO weekday of a date: 1 = Monday … 7 = Sunday. */
export function isoWeekday(date: string): number {
	const [y, m, d] = date.split('-').map(Number);
	return new Date(Date.UTC(y, m - 1, d)).getUTCDay() || 7;
}

/** Weeks of the month starting on `firstDay` (1 = Monday); null pads days outside the month. */
export function monthWeeks(month: string, firstDay = 1): (string | null)[][] {
	const days = monthDays(month);
	const lead = (isoWeekday(days[0]) - firstDay + 7) % 7;
	const cells: (string | null)[] = [...Array(lead).fill(null), ...days];
	while (cells.length % 7) cells.push(null);
	return Array.from({ length: cells.length / 7 }, (_, i) => cells.slice(i * 7, i * 7 + 7));
}

export function shiftMonth(month: string, delta: number): string {
	const [y, m] = month.split('-').map(Number);
	const d = new Date(Date.UTC(y, m - 1 + delta, 1));
	return d.toISOString().slice(0, 7);
}

export interface MonthData {
	/** Energy eaten per logged day (days with at least one entry). */
	eaten: Map<string, number>;
	/** Counted activity per day. */
	activity: Map<string, number>;
	completed: Set<string>;
	versions: TargetLike[];
}

export function calendarDays(month: string, today: string, data: MonthData): CalendarDay[] {
	return monthDays(month).map((date) => {
		const isToday = date === today;
		const logged = data.eaten.has(date);
		const eatenKcal = data.eaten.get(date) ?? 0;
		const budget = budgetForDay(targetOn(data.versions, date), data.activity.get(date) ?? 0);
		const budgetKcal = budget?.budget ?? null;
		const fill = budgetKcal ? Math.min(eatenKcal / budgetKcal, 1) : 0;
		let status: DayStatus;
		if (date > today) status = 'future';
		else if (!logged) status = 'unlogged';
		else if (budgetKcal === null) status = 'no_budget';
		else if (eatenKcal > budgetKcal) status = 'over';
		else status = data.completed.has(date) ? 'under' : 'incomplete';
		return { date, status, eatenKcal, budgetKcal, fill: status === 'over' ? 1 : fill, isToday };
	});
}

export interface MonthSummary {
	under: number;
	over: number;
	incomplete: number;
	unlogged: number;
}

/** Counts past days only; today is still in progress (docs/ui.md). */
export function monthSummary(days: CalendarDay[]): MonthSummary {
	const past = days.filter((d) => !d.isToday && d.status !== 'future');
	const count = (s: DayStatus) => past.filter((d) => d.status === s).length;
	return {
		under: count('under'),
		over: count('over'),
		incomplete: count('incomplete') + count('no_budget'),
		unlogged: count('unlogged')
	};
}
