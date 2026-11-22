// The paces a calculated budget offers, named as on the Goal page ("Steady · 0,25 kg a week"). Kilograms a week, as
// stored; people who use pounds get round pounds (0.5, 1, 1.5, 2 lb a week), kept in kilograms like every weight.
import { m } from '#lib/paraglide/messages.js';
import { formatDecimal } from '#lib/shared/numbers.ts';
import { fromKg, toKg, type WeightUnit } from '#lib/shared/weight-unit.ts';

const KG_PACES = [0, 0.25, 0.5, 0.75, 1];
const LB_PACES = [0, 0.5, 1, 1.5, 2];

/** The paces offered, in kilograms a week. */
export const paces = (unit: WeightUnit): number[] =>
	unit === 'lb' ? LB_PACES.map((lb) => toKg(lb, 'lb')) : KG_PACES;

/** "0.5" kg or "1" lb: a pace in the person's unit. */
export const paceAmount = (rateKg: number, unit: WeightUnit): string =>
	formatDecimal(fromKg(rateKg, unit), unit === 'lb' ? 1 : 2);

export function paceLabel(rate: number, unit: WeightUnit): string {
	if (rate <= 0) return m.onb_rate_maintain();
	// The names fit both lists: 0.5 lb is about 0.23 kg, 2 lb about 0.91 kg.
	const name =
		rate <= 0.25
			? m.pace_steady()
			: rate <= 0.5
				? m.pace_brisk()
				: rate <= 0.75
					? m.pace_fast()
					: m.pace_fastest();
	return m.pace_label({ name, pace: paceAmount(rate, unit), unit });
}
