// Kilograms and pounds (owner, 2026-11-22), with no interface text: the worker and the server read these too, and
// the worker runs without the message catalog. Formatting is in weight-unit.ts.

export const WEIGHT_UNITS = ['kg', 'lb'] as const;
export type WeightUnit = (typeof WEIGHT_UNITS)[number];

/** A pound is exactly 0.45359237 kg, and an ounce a sixteenth of it (the one place these are written). */
export const KG_PER_LB = 0.45359237;
export const G_PER_OZ = (KG_PER_LB * 1000) / 16;

/** A weight in kilograms, in the person's unit. */
export const fromKg = (kg: number, unit: WeightUnit): number =>
	unit === 'lb' ? kg / KG_PER_LB : kg;

/** A weight typed in the person's unit, in kilograms. */
export const toKg = (value: number, unit: WeightUnit): number =>
	unit === 'lb' ? value * KG_PER_LB : value;

/** A typed value back in kilograms, kept to the two decimals the database stores. */
export const typedKg = (value: number, unit: WeightUnit): number =>
	Math.round(toKg(value, unit) * 100) / 100;
