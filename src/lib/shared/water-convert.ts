// Millilitres, or US fluid ounces (owner, 2026-11-22), for water. No interface text: the server reads these too. Water
// is always stored in millilitres with one decimal; the person's unit only changes how it is shown and typed.

export const WATER_UNITS = ['ml', 'floz'] as const;
export type WaterUnit = (typeof WATER_UNITS)[number];

/** A US fluid ounce is exactly 29.5735295625 ml (the one place this is written). */
export const ML_PER_FL_OZ = 29.5735295625;

/** Millilitres in the person's unit. */
export const fromMl = (ml: number, unit: WaterUnit): number =>
	unit === 'floz' ? ml / ML_PER_FL_OZ : ml;

/** An amount typed in the person's unit, in millilitres, kept to the one decimal the database stores. */
export const toMl = (value: number, unit: WaterUnit): number =>
	Math.round((unit === 'floz' ? value * ML_PER_FL_OZ : value) * 10) / 10;
