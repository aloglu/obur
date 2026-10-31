// The Journal's month of highlights (docs/ui.md, "Achievements, Journal and Help"): the month's weeks, newest first
// and cut at the month's edges, each with one summary and only the moments that mattered. Averages count only days
// marked complete, as everywhere else in Progress; nothing unknown is shown as zero.
import type { Achievement } from './achievements.ts';
import { isoWeekday, targetOn, type CalendarDay, type TargetLike } from './calendar.ts';
import { addDays } from './diary-rules.ts';
import { budgetForDay } from './goals.ts';

export type JournalEvent =
	/** The week's lowest weigh-in, below every earlier one. */
	| { kind: 'lowest'; date: string; kg: number }
	/** The budget for an inactive day differs at the week's end from just before it (null: no budget). */
	| { kind: 'budget'; date: string; from: number | null; to: number | null }
	/** The first day anything was logged. */
	| { kind: 'first_day'; date: string }
	/** An achievement reached that day. */
	| { kind: 'achievement'; date: string; achievement: Achievement };

export interface JournalWeek {
	from: string;
	to: string;
	/** Contains today. */
	current: boolean;
	/** Days marked complete in the week. */
	completeDays: number;
	/** Average eaten on complete days. */
	averageKcal: number | null;
	/** Average of eaten minus budget on complete days that had a budget: negative is under. */
	averageDiff: number | null;
	/** The week's last weigh-in minus the last one before the week. */
	weightChange: number | null;
	/** Newest first. */
	events: JournalEvent[];
}

export interface JournalInput {
	month: string;
	today: string;
	/** 1 = Monday … 7 = Sunday. */
	firstDayOfWeek: number;
	/** The month's calendar (shared/calendar.ts). */
	days: CalendarDay[];
	completed: Set<string>;
	/** Every weigh-in up to the month's end, in date order; a day's last one counts. */
	readings: { localDate: string; value: number }[];
	versions: TargetLike[];
	/** The first day anything was logged, if ever. */
	firstDay: string | null;
	/** Achievements reached, any order. */
	achievements?: Achievement[];
}

const inactiveBudget = (versions: TargetLike[], date: string) =>
	budgetForDay(targetOn(versions, date), 0)?.budget ?? null;

export function journal(input: JournalInput): JournalWeek[] {
	const { today, days, completed, versions } = input;
	const past = days.filter((d) => d.date <= today);
	if (!past.length) return [];

	// A day's last weigh-in.
	const byDay = new Map<string, number>();
	for (const r of input.readings) byDay.set(r.localDate, r.value);
	const weighIns = [...byDay].sort(([a], [b]) => (a < b ? -1 : 1));

	const weeks: JournalWeek[] = [];
	let start = 0;
	while (start < past.length) {
		let end = start;
		while (end + 1 < past.length && isoWeekday(past[end + 1].date) !== input.firstDayOfWeek) end++;
		const week = past.slice(start, end + 1);
		const from = week[0].date;
		const to = week.at(-1)!.date;
		start = end + 1;

		const complete = week.filter((d) => completed.has(d.date) && d.status !== 'unlogged');
		const budgeted = complete.filter((d) => d.budgetKcal !== null);
		const mean = (values: number[]) =>
			values.length ? Math.round(values.reduce((a, b) => a + b, 0) / values.length) : null;

		const before = weighIns.filter(([d]) => d < from);
		const within = weighIns.filter(([d]) => d >= from && d <= to);
		const lastBefore = before.at(-1)?.[1] ?? null;
		const lastWithin = within.at(-1)?.[1] ?? null;

		const events: JournalEvent[] = [];
		if (before.length && within.length) {
			const lowestBefore = Math.min(...before.map(([, v]) => v));
			const low = within.reduce((best, r) => (r[1] < best[1] ? r : best));
			if (low[1] < lowestBefore) events.push({ kind: 'lowest', date: low[0], kg: low[1] });
		}
		const changes = versions.filter((v) => v.effectiveFrom >= from && v.effectiveFrom <= to);
		if (changes.length) {
			const was = inactiveBudget(versions, addDays(from, -1));
			const now = inactiveBudget(versions, to);
			const date = changes
				.map((v) => v.effectiveFrom)
				.sort()
				.at(-1)!;
			if (was !== now) events.push({ kind: 'budget', date, from: was, to: now });
		}
		if (input.firstDay && input.firstDay >= from && input.firstDay <= to) {
			events.push({ kind: 'first_day', date: input.firstDay });
		}
		for (const achievement of input.achievements ?? []) {
			if (achievement.date >= from && achievement.date <= to)
				events.push({ kind: 'achievement', date: achievement.date, achievement });
		}
		// Newest first; on the same day, achievements lead.
		const rank = (e: JournalEvent) => (e.kind === 'achievement' ? 0 : 1);
		events.sort((a, b) => (a.date !== b.date ? (a.date < b.date ? 1 : -1) : rank(a) - rank(b)));

		const logged = week.some((d) => d.status !== 'unlogged');
		if (!logged && !within.length && !events.length) continue;
		weeks.push({
			from,
			to,
			current: to === today,
			completeDays: complete.length,
			averageKcal: mean(complete.map((d) => d.eatenKcal)),
			averageDiff: mean(budgeted.map((d) => d.eatenKcal - d.budgetKcal!)),
			weightChange:
				lastBefore !== null && lastWithin !== null
					? Math.round((lastWithin - lastBefore) * 10) / 10
					: null,
			events
		});
	}
	return weeks.reverse();
}
