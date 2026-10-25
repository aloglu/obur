// Decimal input accepting comma or dot (docs/design.md, "Targets, profile and activity" and "Language and
// interface"). One separator is always the decimal mark; thousands separators are not accepted, so "1.234" and
// "1,234" both mean 1.234 rather than a guess.

export function parseDecimal(input: string): number | undefined {
	const s = input.trim().replace(/\s+/g, '');
	if (!/^\d+([.,]\d+)?$|^[.,]\d+$/.test(s)) return undefined;
	const value = Number(s.replace(',', '.'));
	return Number.isFinite(value) ? value : undefined;
}

/** Formats with a decimal comma or dot and at most `digits` decimals, dropping trailing zeros. */
export function formatDecimal(value: number, decimalMark: ',' | '.' = ',', digits = 2): string {
	// Strip trailing zeros only after a decimal point (200 stays 200; 2.50 becomes 2.5).
	const fixed = value
		.toFixed(digits)
		.replace(/(\.\d*?)0+$/, '$1')
		.replace(/\.$/, '');
	return decimalMark === ',' ? fixed.replace('.', ',') : fixed;
}
