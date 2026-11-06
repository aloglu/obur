// The paces a calculated budget offers, named as on the Goal page ("Steady · 0,25 kg a week").
import { m } from '#lib/paraglide/messages.js';
import { formatDecimal } from '#lib/shared/numbers.ts';

export const PACES = [0, 0.25, 0.5, 0.75, 1];

export function paceLabel(rate: number): string {
	if (rate <= 0) return m.onb_rate_maintain();
	const name =
		rate <= 0.25
			? m.pace_steady()
			: rate <= 0.5
				? m.pace_brisk()
				: rate <= 0.75
					? m.pace_fast()
					: m.pace_fastest();
	return m.pace_label({ name, kg: formatDecimal(rate, ',', 2) });
}
