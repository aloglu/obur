// Kilograms or pounds (owner, 2026-11-22). Weights are always stored in kilograms; the person's unit
// (shared/preferences.ts) only changes how they are shown and typed. A pound is exactly 0.45359237 kg.
import { fixedDecimal, formatDecimal } from './numbers.ts';

export const WEIGHT_UNITS = ['kg', 'lb'] as const;
export type WeightUnit = (typeof WEIGHT_UNITS)[number];

export const KG_PER_LB = 0.45359237;

/** A weight in kilograms, in the person's unit. */
export const fromKg = (kg: number, unit: WeightUnit): number =>
	unit === 'lb' ? kg / KG_PER_LB : kg;

/** A weight typed in the person's unit, in kilograms. */
export const toKg = (value: number, unit: WeightUnit): number =>
	unit === 'lb' ? value * KG_PER_LB : value;

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

/** A typed value back in kilograms, kept to the two decimals the database stores. */
export const typedKg = (value: number, unit: WeightUnit): number =>
	Math.round(toKg(value, unit) * 100) / 100;
