// Height, waist and water in the person's units (owner, 2026-11-22). Stored in centimetres and millilitres; the
// conversions are in length-convert.ts and water-convert.ts (no interface text, so the server can read them); this
// file adds the formatting, which needs the language's decimal mark. Unit symbols are not translated, as kg and lb.
import { formatDecimal } from './numbers.ts';
import { cmToFeetInches, cmToInches, type LengthUnit } from './length-convert.ts';
import { fromMl, type WaterUnit } from './water-convert.ts';

export * from './length-convert.ts';
export * from './water-convert.ts';

/** "177.8 cm" or "5 ft 10 in". */
export function heightText(cm: number, unit: LengthUnit): string {
	if (unit === 'cm') return `${formatDecimal(cm, 1)} cm`;
	const { feet, inches } = cmToFeetInches(cm);
	return `${feet} ft ${formatDecimal(inches, 1)} in`;
}

/** "86.4 cm" or "34 in". */
export const waistText = (cm: number, unit: LengthUnit): string =>
	unit === 'cm' ? `${formatDecimal(cm, 1)} cm` : `${formatDecimal(cmToInches(cm), 1)} in`;

/** The water unit's symbol: "ml" or "fl oz". */
export const waterSymbol = (unit: WaterUnit): string => (unit === 'floz' ? 'fl oz' : 'ml');

/** "750" ml or "8" fl oz (to a tenth): the number alone, trailing zeros dropped. */
export const waterNumber = (ml: number, unit: WaterUnit): string =>
	formatDecimal(fromMl(ml, unit), unit === 'floz' ? 1 : 0);

/** "750 ml" or "8 fl oz". */
export const waterText = (ml: number, unit: WaterUnit): string =>
	`${waterNumber(ml, unit)} ${waterSymbol(unit)}`;
