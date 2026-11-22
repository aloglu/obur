// Whether a weigh-in (kg) or water (ml) value fits its column once stored at the column's precision: kilos to 0.01,
// under 700; millilitres to 0.1, at most 10 litres (drizzle/0009_body_tables.sql). Checked on the stored value:
// 699.999 kg became 700.00 and 10000.5 ml stayed past the limit, and the request failed (2026-11-22 Gemini audit, G26).
const at = (value: number, places: number) => Math.round(value * places) / places;

export function readingFits(kind: 'weight' | 'water', value: number): boolean {
	if (!Number.isFinite(value) || value <= 0) return false;
	return kind === 'weight' ? at(value, 100) < 700 : at(value, 10) <= 10_000;
}
