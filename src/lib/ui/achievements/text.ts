// The words for an achievement, wherever it appears (toast, celebration, badge page, Journal).
import { m } from '#lib/paraglide/messages.js';
import type { Achievement } from '#lib/shared/achievements.ts';
import { nearestKgLevel } from '#lib/shared/achievements.ts';
import { formatDecimal } from '#lib/shared/numbers.ts';
import { weightText } from '#lib/shared/weight-unit.ts';
import { weightUnit } from '#lib/client/weight-unit.ts';
import {
	FIRST_PICTURES,
	GOAL_PICTURE,
	STREAK_PICTURE,
	weightPicture
} from '#lib/shared/achievement-display.ts';

const messages = m as unknown as Record<string, (() => string) | undefined>;

type WeightMark = Pick<Extract<Achievement, { kind: 'weight' | 'weight_lb' }>, 'kind' | 'level'>;

/** "16 kg" or "35 lb": a weight mark with its unit. */
export const markText = (a: WeightMark) =>
	`${formatDecimal(a.level, 2)} ${a.kind === 'weight_lb' ? 'lb' : 'kg'}`;

/**
 * A pound mark's own words where the kilo mark's would name kilos (owner, 2026-11-22: "a 35 lb kettlebell"); otherwise
 * the nearest kilo mark's. `suffix` is "" for the comparison, "_line" for the closing line.
 */
function weightMessage(a: WeightMark, suffix: '' | '_line'): string | null {
	if (a.kind === 'weight_lb') {
		const own = messages[`achievement_weight_lb_${a.level}${suffix}`];
		if (own) return own();
	}
	const kg = a.kind === 'weight_lb' ? nearestKgLevel(a.level) : a.level;
	return messages[`achievement_weight_${kg}${suffix}`]?.() ?? null;
}

/** "a chihuahua": the weight comparison for a mark, if there is one. */
export const comparison = (a: WeightMark) => weightMessage(a, '');

export function achievementTitle(a: Achievement): string {
	switch (a.kind) {
		case 'weight':
		case 'weight_lb':
			return m.achievement_weight_title({ weight: markText(a) });
		case 'goal':
			// Goal weights are kilograms, shown in the person's unit.
			return m.achievement_goal_title({ weight: weightText(a.level, weightUnit()) });
		case 'streak':
			return m.achievement_streak_title({ days: String(a.level) });
		case 'first':
			return firstName(a.level);
	}
}

export function firstName(first: Extract<Achievement, { kind: 'first' }>['level']): string {
	return {
		weigh_in: m.achievements_first_weigh_in,
		day_logged: m.achievements_first_day_logged,
		complete_day: m.achievements_first_complete_day,
		scan: m.achievements_first_scan,
		voice: m.achievements_first_voice,
		recipe: m.achievements_first_recipe
	}[first]();
}

/** The second line: "That's a chihuahua" for weight, a short line otherwise. */
export function achievementDetail(a: Achievement): string {
	switch (a.kind) {
		case 'weight':
		case 'weight_lb': {
			const what = comparison(a);
			return what ? m.achievement_weight_that({ what }) : '';
		}
		case 'goal':
			return m.achievement_goal_line();
		case 'streak':
			return m.achievement_streak_line();
		case 'first':
			return {
				weigh_in: m.achievement_first_weigh_in_line,
				day_logged: m.achievement_first_day_logged_line,
				complete_day: m.achievement_first_complete_day_line,
				scan: m.achievement_first_scan_line,
				voice: m.achievement_first_voice_line,
				recipe: m.achievement_first_recipe_line
			}[a.level]();
	}
}

/** The celebration's closing line: the comparison's own line for weight. */
export function achievementLine(a: Achievement): string {
	if (a.kind === 'weight' || a.kind === 'weight_lb') return weightMessage(a, '_line') ?? '';
	return achievementDetail(a);
}

export function achievementPicture(a: Achievement): string {
	switch (a.kind) {
		case 'weight':
		case 'weight_lb':
			return weightPicture(a) ?? GOAL_PICTURE;
		case 'goal':
			return GOAL_PICTURE;
		case 'streak':
			return STREAK_PICTURE;
		case 'first':
			return FIRST_PICTURES[a.level];
	}
}

export const achievementEyebrow = (a: Achievement) =>
	({
		weight: m.achievement_eyebrow_weight,
		weight_lb: m.achievement_eyebrow_weight,
		goal: m.achievement_eyebrow_goal,
		streak: m.achievement_eyebrow_streak,
		first: m.achievement_eyebrow_first
	})[a.kind]();
