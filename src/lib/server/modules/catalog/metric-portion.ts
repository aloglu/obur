// Metric names for USDA household portions. SR Legacy describes portions in US units ("medium (7" to 7-7/8" long)",
// "can 12 fl oz", "oz (14 halves)"); the gram weight is what the app uses, but the name is what people choose by, so
// it is rewritten: inches to centimetres, ounces and pounds to grams, fluid ounces to millilitres, and US cups named
// as such with their volume. Portions that only restate a unit the g option already covers are dropped (null).
// Pure; applied at build time.

const INCH_CM = 2.54;
const OZ_G = 28.349523125;
const LB_G = 453.59237;
const FL_OZ_ML = 29.5735295625;
export const US_CUP = 'US cup (237 ml)';

/** "2-1/4", "1/4", "7", "1.33" → a number. */
const NUM = String.raw`\d+(?:\.\d+)?-\d+/\d+|\d+/\d+|\d+(?:\.\d+)?`;
function parse(text: string): number {
	const mixed = /^(\d+)-(\d+)\/(\d+)$/.exec(text);
	if (mixed) return Number(mixed[1]) + Number(mixed[2]) / Number(mixed[3]);
	const fraction = /^(\d+)\/(\d+)$/.exec(text);
	if (fraction) return Number(fraction[1]) / Number(fraction[2]);
	return Number(text);
}

// English names with decimal points (the stored ones); Turkish shows its own (shared/curated-names.ts).
const decimal = (n: number) => String(n);
/** Centimetres: one decimal below 3 cm, whole numbers above. */
const cm = (inches: number) => {
	const v = inches * INCH_CM;
	return v < 3 ? decimal(Math.round(v * 10) / 10) : String(Math.round(v));
};
/** "6–8 cm", or "6 cm" when both ends round alike (SR Legacy has "2-1/4" to 2-1/4""). */
const range = (a: string, b: string) => (a === b ? `${a} cm` : `${a}–${b} cm`);
const grams = (oz: number) => `${Math.round(oz * OZ_G)} g`;
const ml = (flOz: number) => `${Math.round(flOz * FL_OZ_ML)} ml`;

/** Bare units: the g (or ml) option already covers them. */
const UNIT_ONLY = /^(oz|lb|fl oz|quart)$/i;

export function metricPortionName(original: string): string | null {
	let s = original.trim().replace(/-\/(\d)/g, '-$1'); // "8-/1/2"" in SR Legacy's own text
	if (UNIT_ONLY.test(s)) return null;

	// A one-ounce portion described by its count: "oz (14 halves)" → "14 halves".
	const counted = /^oz \((.+)\)$/i.exec(s);
	if (counted) s = counted[1];

	// Inches. Ranges first ("7" to 7-7/8"", "6-7"", "1-3/4" to 2-1/2""), then single measures, then numbers that
	// SR Legacy left without the inch mark before "dia".
	s = s.replace(
		new RegExp(String.raw`(${NUM})"?\s+to\s+(${NUM})"`, 'g'),
		(_, a: string, b: string) => range(cm(parse(a)), cm(parse(b)))
	);
	s = s.replace(/(\d+)-(\d+)"/g, (_, a: string, b: string) => range(cm(Number(a)), cm(Number(b))));
	s = s.replace(new RegExp(String.raw`(${NUM})"`, 'g'), (_, a: string) => `${cm(parse(a))} cm`);
	s = s.replace(
		new RegExp(String.raw`(${NUM})(\s+dia\b)`, 'g'),
		(_, a: string, rest: string) => `${cm(parse(a))} cm${rest}`
	);
	s = s
		.replace(/\bcubic inch\b/gi, '2.5 cm cube')
		.replace(/\bdia\b\.?/gi, 'across')
		.replace(/\bsq\b\.?/gi, 'square')
		.replace(/ x /g, ' × ');

	// Weights. "2-1/4 per lb" → "about 5 per kg"; other pounds and ounces → grams.
	s = s.replace(
		new RegExp(String.raw`(${NUM})\s+per\s+(?:lb|pound)\b`, 'gi'),
		(_, a: string) => `about ${Math.round(parse(a) / (LB_G / 1000))} per kg`
	);
	s = s.replace(new RegExp(String.raw`(${NUM})\s+(?:lb|pound)s?\b`, 'gi'), (_, a: string) =>
		grams((parse(a) * LB_G) / OZ_G)
	);
	// Volumes. "(8 fl oz)" → "(237 ml)"; "can 12 fl oz" → "can (355 ml)".
	s = s.replace(
		new RegExp(String.raw`\((${NUM})\s+fl oz\)`, 'gi'),
		(_, a: string) => `(${ml(parse(a))})`
	);
	s = s.replace(
		new RegExp(String.raw`\s(${NUM})\s+fl oz\b`, 'gi'),
		(_, a: string) => ` (${ml(parse(a))})`
	);
	s = s.replace(new RegExp(String.raw`(${NUM})\s+oz\b`, 'gi'), (_, a: string) => grams(parse(a)));
	s = s.replace(/\bpint\b/gi, 'US pint (473 ml)');

	// Spoons are near enough everywhere; cups are a US volume, so they say so.
	s = s.replace(/^tbsp\b,?\s*/i, (m) =>
		m.trim().length < m.length ? 'tablespoon, ' : 'tablespoon'
	);
	s = s.replace(/^tsp\b,?\s*/i, (m) => (m.trim().length < m.length ? 'teaspoon, ' : 'teaspoon'));
	s = s.replace(/^cup \((\d+ ml)\)/i, 'US cup ($1)');
	s = s.replace(/^cup \(([^)]+)\)/i, `${US_CUP}, $1`); // "cup (not packed)"
	s = s.replace(/^cup\b,?\s*/i, (m) => (m.trim().length < m.length ? `${US_CUP}, ` : US_CUP));
	s = s.replace(/,\s*$/, '');

	if (s.length > 60) s = s.replace(US_CUP, 'US cup');
	return s.replace(/\s+/g, ' ').trim().slice(0, 60).trim();
}
