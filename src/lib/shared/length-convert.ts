// Centimetres, or feet and inches (owner, 2026-11-22), for height and waist. No interface text: the server reads these
// too. Lengths are always stored in centimetres with one decimal; the person's unit only changes how they are shown
// and typed. Height reads as feet and inches ("5 ft 10 in"), a waist in inches alone ("34 in").

export const LENGTH_UNITS = ['cm', 'in'] as const;
export type LengthUnit = (typeof LENGTH_UNITS)[number];

/** An inch is exactly 2.54 cm. */
export const CM_PER_IN = 2.54;

/** Centimetres kept to the one decimal the database stores. */
const tenth = (n: number) => Math.round(n * 10) / 10;

/** Inches in centimetres (one decimal, as stored). */
export const inchesToCm = (inches: number): number => tenth(inches * CM_PER_IN);

/** Centimetres in inches, to a tenth: 177.8 cm is 70 in, 86.4 cm is 34 in. */
export const cmToInches = (cm: number): number => tenth(cm / CM_PER_IN);

/** Feet and inches in centimetres: 5 ft 10 in is 177.8 cm. */
export const feetInchesToCm = (feet: number, inches: number): number =>
	inchesToCm(feet * 12 + inches);

/**
 * Centimetres as whole feet and inches to a tenth, with no 12 inches: 177.8 cm is 5 ft 10 in, 182.88 cm is 6 ft 0 in.
 * A height typed in feet and inches shows again as typed.
 */
export function cmToFeetInches(cm: number): { feet: number; inches: number } {
	const total = cmToInches(cm);
	const feet = Math.floor(total / 12 + 1e-9);
	return { feet, inches: tenth(total - feet * 12) };
}
