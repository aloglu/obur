// Kilograms or pounds (owner, 2026-11-22). Weights are always stored in kilograms; the person's unit
// (shared/preferences.ts) only changes how they are shown and typed. Conversions: weight-convert.ts (no interface text,
// so the worker can read them); this file adds the formatting, which needs the language's decimal mark.
import { fixedDecimal, formatDecimal } from './numbers.ts';

export {
	WEIGHT_UNITS,
	KG_PER_LB,
	fromKg,
	toKg,
	typedKg,
	type WeightUnit
} from './weight-convert.ts';
import { fromKg, type WeightUnit } from './weight-convert.ts';

/**
 * Decimals shown. Kilograms are stored with two decimals (10 g, about 0.02 lb), so pounds show one: a typed 185.2 lb
 * is stored as 84.00 kg and shows again as 185.2 lb.
 */
export const weightDigits = (unit: WeightUnit): number => (unit === 'lb' ? 1 : 2);

/** "84.65" kg or "186.6" lb: the number alone, trailing zeros dropped. */
export const weightNumber = (kg: number, unit: WeightUnit): string =>
	formatDecimal(fromKg(kg, unit), weightDigits(unit));

/** "84.65 kg" or "186.6 lb". */
export const weightText = (kg: number, unit: WeightUnit): string =>
	`${weightNumber(kg, unit)} ${unit}`;

/** One decimal, zero kept ("84.0", "185.2"): charts and summaries. */
export const weightFixed = (kg: number, unit: WeightUnit): string =>
	fixedDecimal(fromKg(kg, unit), 1);
