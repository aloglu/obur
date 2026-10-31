// How achievements look (docs/ui.md, "Achievements, Journal and Help"): the picture for each weight comparison (shown
// only in the celebration; badges carry the number), the pictures and colours of the other badges, and how the
// kilo badges' tint deepens. Pictures are OpenMoji files in static/icons/achievements (dark variants beside them).
import type { Achievement, First } from './achievements.ts';

/** OpenMoji picture for each weight comparison (docs/achievement-comparisons.md). */
export const WEIGHT_PICTURES: Record<number, string> = {
	2: '1F415',
	4: '1F383',
	6: '1F3B3',
	8: '1F349',
	10: '1F6DE',
	12: '1F9F5',
	14: '1F436',
	16: '1F3CB',
	18: '1F50B',
	20: '1F9F3',
	22: '1FA91',
	24: '1F9AE',
	26: '1F35A',
	28: '1F4FA',
	30: '1F6A3',
	32: '1F369',
	34: '2668',
	36: '1F427',
	38: '1F9CA',
	40: '1F6F4',
	42: '1F37D',
	44: '1F43A',
	46: '1F34A',
	48: '26F3',
	50: '1F9F1',
	52: '1F300',
	54: '1F951',
	56: '1F94A',
	58: '2692',
	60: '1FAE7',
	62: '1F34D',
	64: '1F6CB',
	66: '1F6B2',
	68: '1F9CA',
	70: '1F3C3',
	72: '1F6DE',
	74: '1F34C',
	76: '1FAB5',
	78: '1F998',
	80: '1F9CA',
	82: '1F3CB',
	84: '1F9C0',
	86: '1F6F5',
	88: '1F392',
	90: '1F6AA',
	92: '1F3CB',
	94: '1F9C6',
	96: '1F439',
	98: '1F579',
	100: '1F418',
	102: '1F6D2',
	104: '1F6AA',
	106: '1F9C1',
	108: '1F3CD',
	110: '2744',
	112: '1F6F5',
	114: '1F95A',
	116: '1F510',
	118: '1F94A',
	120: '1F43C'
};
export const STREAK_PICTURE = '1F525';
export const GOAL_PICTURE = '1F3AF';
export const FIRST_PICTURES: Record<First, string> = {
	scan: '1F4F7',
	voice: '1F399',
	recipe: '1F372'
};

export const pictureUrl = (hex: string, dark = false) =>
	`/icons/achievements/${dark ? 'dark/' : ''}${hex}.svg`;

/** Badge colours (tokens `--badge-*`): streaks warm with length, each first its own, the goal teal. */
export type BadgeHue = 'coral' | 'amber' | 'rose' | 'violet' | 'blue' | 'teal' | 'green';
const STREAK_HUES: BadgeHue[] = ['amber', 'coral', 'rose', 'violet', 'blue', 'teal', 'green'];
const FIRST_HUES: Record<First, BadgeHue> = { scan: 'blue', voice: 'violet', recipe: 'green' };

export function badgeHue(a: Pick<Achievement, 'kind' | 'level'>, streakLevels: number[]): BadgeHue {
	switch (a.kind) {
		case 'weight':
			return 'coral';
		case 'goal':
			return 'teal';
		case 'streak':
			return STREAK_HUES[Math.max(0, streakLevels.indexOf(a.level as number)) % STREAK_HUES.length];
		case 'first':
			return FIRST_HUES[a.level as First];
	}
}

/**
 * A kilo badge's tint: 10 % of the colour for the first 10 kg, 8 points more for every further 10 kg (98 % at
 * 120 kg). The number's ink changes as the tint deepens so it keeps its contrast (tokens `--kilo-ink-1..3`,
 * checked in tokens.test.ts).
 */
export function kiloTint(level: number): { percent: number; ink: 1 | 2 | 3 } {
	const step = Math.floor((level - 1) / 10);
	return { percent: 10 + step * 8, ink: step <= 3 ? 1 : step <= 6 ? 2 : 3 };
}
export const KILO_TINT_STEPS = 12;
