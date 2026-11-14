import { getLocale } from '#lib/paraglide/runtime.js';

// Decimal input accepting comma or dot (docs/design.md, "Targets, profile and activity" and "Language and
// interface"). One separator is always the decimal mark; thousands separators are not accepted, so "1.234" and
// "1,234" both mean 1.234 rather than a guess.

export function parseDecimal(input: string): number | undefined {
	const s = input.trim().replace(/\s+/g, '');
	if (!/^\d+([.,]\d+)?$|^[.,]\d+$/.test(s)) return undefined;
	const value = Number(s.replace(',', '.'));
	return Number.isFinite(value) ? value : undefined;
}

/** The decimal mark of the interface language: a period in English, a comma in Turkish. Input takes either. */
export const decimalMark = (): ',' | '.' => (getLocale() === 'tr' ? ',' : '.');

/** Formats with the language's decimal mark (or the one given) and at most `digits` decimals, dropping trailing zeros. */
export function formatDecimal(value: number, digits = 2, mark: ',' | '.' = decimalMark()): string {
	// Strip trailing zeros only after a decimal point (200 stays 200; 2.50 becomes 2.5).
	const fixed = value
		.toFixed(digits)
		.replace(/(\.\d*?)0+$/, '$1')
		.replace(/\.$/, '');
	return mark === ',' ? fixed.replace('.', ',') : fixed;
}

/** A fixed number of decimals, zeros kept ("84.0"), with the language's decimal mark. */
export const fixedDecimal = (
	value: number,
	digits: number,
	mark: ',' | '.' = decimalMark()
): string => {
	const fixed = value.toFixed(digits);
	return mark === ',' ? fixed.replace('.', ',') : fixed;
};

/** A percentage the way the language writes it: "18 %" in English, "%18" in Turkish. */
export const percentText = (value: number, digits = 1): string =>
	getLocale() === 'tr' ? `%${formatDecimal(value, digits)}` : `${formatDecimal(value, digits)} %`;
