// Achievements (docs/design.md, "Progress, graphs and optional encouragement"; docs/ui.md, "Achievements, Journal and
// Help"). Worked out from the person's records, so a corrected or deleted record withdraws an award it caused, and
// each is reached once: the first day it was reached, however the weight moves afterwards.

/** Weight lost: one every 2 kg up to 120 kg (docs/achievement-comparisons.md). */
export const WEIGHT_STEP_KG = 2;
export const WEIGHT_MAX_KG = 120;
export const WEIGHT_LEVELS = Array.from(
	{ length: WEIGHT_MAX_KG / WEIGHT_STEP_KG },
	(_, i) => (i + 1) * WEIGHT_STEP_KG
);
/** Streaks of complete days in a row; 3 is a first step for a new account (owner, 2026-11-07). */
export const STREAK_LEVELS = [3, 7, 14, 30, 60, 100, 180, 365];
/** The first steps (weigh-in, a day logged, a complete day) and the first scan, voice log and recipe. */
export const FIRSTS = [
	'weigh_in',
	'day_logged',
	'complete_day',
	'scan',
	'voice',
	'recipe'
] as const;
export type First = (typeof FIRSTS)[number];

export type Achievement =
	| { kind: 'weight'; level: number; date: string }
	| { kind: 'goal'; level: number; date: string }
	| { kind: 'streak'; level: number; date: string }
	| { kind: 'first'; level: First; date: string };
export type AchievementKind = Achievement['kind'];

/** One achievement's identity: what is reached once only. */
export const achievementKey = (a: Pick<Achievement, 'kind' | 'level'>) => `${a.kind}:${a.level}`;

export interface AchievementInput {
	/** Every weigh-in, in date order; a day's last one counts. */
	readings: { localDate: string; value: number }[];
	/** Goal weights over time: the newest version on or before a day applies. */
	goals: { effectiveFrom: string; createdAt: string; goalWeightKg: number | null }[];
	/** Days marked complete, any order. */
	completed: string[];
	/**
	 * Firsts that aren't in the records above, if any: the first day with a diary entry, the first label scan saved,
	 * the first voice log and the first recipe. The first weigh-in and complete day come from `readings` and `completed`.
	 */
	firsts: Partial<Record<Exclude<First, 'weigh_in' | 'complete_day'>, string>>;
	/** Weight celebrations apply: an adult who is neither pregnant nor breastfeeding, with a goal below the start. */
	weightAllowed: boolean;
}

function goalOn(goals: AchievementInput['goals'], date: string): number | null {
	let best: AchievementInput['goals'][number] | null = null;
	for (const g of goals) {
		if (g.effectiveFrom > date) continue;
		if (
			!best ||
			g.effectiveFrom > best.effectiveFrom ||
			(g.effectiveFrom === best.effectiveFrom && g.createdAt > best.createdAt)
		)
			best = g;
	}
	return best?.goalWeightKg ?? null;
}

const nextDay = (date: string) => {
	const [y, m, d] = date.split('-').map(Number);
	return new Date(Date.UTC(y, m - 1, d + 1)).toISOString().slice(0, 10);
};

/** The weight everything is measured from: the earliest day's weigh-in. */
export function startWeight(readings: AchievementInput['readings']): number | null {
	if (!readings.length) return null;
	const first = readings[0].localDate;
	return readings.filter((r) => r.localDate === first).at(-1)!.value;
}

export function achievements(input: AchievementInput): Achievement[] {
	const out: Achievement[] = [];

	const byDay = new Map<string, number>();
	for (const r of input.readings) byDay.set(r.localDate, r.value);
	const start = startWeight(input.readings);
	if (input.weightAllowed && start !== null) {
		let reached = 0;
		const goalsReached = new Set<number>();
		for (const [date, value] of byDay) {
			// Rounded to grams, so 90,0 − 88,0 is 2 kg and not a hair under.
			const lost = Math.round((start - value) * 1000) / 1000;
			for (const level of WEIGHT_LEVELS) {
				if (level <= reached || level > lost) continue;
				out.push({ kind: 'weight', level, date });
			}
			reached = Math.max(reached, lost);
			const goal = goalOn(input.goals, date);
			if (goal !== null && goal < start && value <= goal && !goalsReached.has(goal)) {
				goalsReached.add(goal);
				out.push({ kind: 'goal', level: goal, date });
			}
		}
	}

	const days = [...new Set(input.completed)].sort();
	let run = 0;
	let best = 0;
	let previous: string | null = null;
	for (const date of days) {
		run = previous !== null && nextDay(previous) === date ? run + 1 : 1;
		previous = date;
		for (const level of STREAK_LEVELS) {
			if (level > best && run === level) out.push({ kind: 'streak', level, date });
		}
		best = Math.max(best, run);
	}

	const firsts: Partial<Record<First, string>> = {
		...input.firsts,
		weigh_in: input.readings[0]?.localDate,
		complete_day: days[0]
	};
	for (const kind of FIRSTS) {
		const date = firsts[kind];
		if (date) out.push({ kind: 'first', level: kind, date });
	}
	return out.sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
}

/** The next weight mark and streak to reach, shown as outlines; null once the last is reached. */
export function nextUp(earned: Achievement[]): { weight: number | null; streak: number | null } {
	const has = new Set(earned.map(achievementKey));
	return {
		weight: WEIGHT_LEVELS.find((l) => !has.has(`weight:${l}`)) ?? null,
		streak: STREAK_LEVELS.find((l) => !has.has(`streak:${l}`)) ?? null
	};
}
