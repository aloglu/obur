// The words for an achievement, wherever it appears (toast, celebration, badge page, Journal).
import { m } from '#lib/paraglide/messages.js';
import type { Achievement } from '#lib/shared/achievements.ts';
import {
	FIRST_PICTURES,
	GOAL_PICTURE,
	STREAK_PICTURE,
	WEIGHT_PICTURES
} from '#lib/shared/achievement-display.ts';

const messages = m as unknown as Record<string, (() => string) | undefined>;
const kg = (v: number) => String(v).replace('.', ',');

/** "a chihuahua": the weight comparison for a mark, if there is one. */
export const comparison = (level: number) => messages[`achievement_weight_${level}`]?.() ?? null;

export function achievementTitle(a: Achievement): string {
	switch (a.kind) {
		case 'weight':
			return m.achievement_weight_title({ kg: kg(a.level) });
		case 'goal':
			return m.achievement_goal_title({ kg: kg(a.level) });
		case 'streak':
			return m.achievement_streak_title({ days: String(a.level) });
		case 'first':
			return firstName(a.level);
	}
}

export function firstName(first: Extract<Achievement, { kind: 'first' }>['level']): string {
	return {
		scan: m.achievements_first_scan,
		voice: m.achievements_first_voice,
		recipe: m.achievements_first_recipe
	}[first]();
}

/** The second line: "That's a chihuahua" for weight, a short line otherwise. */
export function achievementDetail(a: Achievement): string {
	switch (a.kind) {
		case 'weight': {
			const what = comparison(a.level);
			return what ? m.achievement_weight_that({ what }) : '';
		}
		case 'goal':
			return m.achievement_goal_line();
		case 'streak':
			return m.achievement_streak_line();
		case 'first':
			return {
				scan: m.achievement_first_scan_line,
				voice: m.achievement_first_voice_line,
				recipe: m.achievement_first_recipe_line
			}[a.level]();
	}
}

/** The celebration's closing line: the comparison's own line for weight. */
export function achievementLine(a: Achievement): string {
	if (a.kind === 'weight') return messages[`achievement_weight_${a.level}_line`]?.() ?? '';
	return achievementDetail(a);
}

export function achievementPicture(a: Achievement): string {
	switch (a.kind) {
		case 'weight':
			return WEIGHT_PICTURES[a.level] ?? GOAL_PICTURE;
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
		goal: m.achievement_eyebrow_goal,
		streak: m.achievement_eyebrow_streak,
		first: m.achievement_eyebrow_first
	})[a.kind]();
