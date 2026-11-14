// Which of a food's own units a parsed amount refers to. Pure. A count word is matched to the food's portions by name
// in both languages ("3 dilim" → its "slice" portion); a bare count ("bir muz") takes a medium portion or the food's
// own serving. Grams and millilitres need a food that converts from them. Anything else is left for the person to
// choose: no weight or density is ever assumed.
import { supportedDimensions, type QuantityModel } from '../../../shared/quantity.ts';
import { offeredAmount, type UnitOption } from '../../../shared/unit-options.ts';
import { genericPortion, turkishPortion } from '../../../shared/curated-names-tr.ts';
import type { CountWord, ParsedUnit } from './parse.ts';
import { fold } from './parse.ts';

/** One of the unit choices the amount sheet offers for the food (shared/unit-options.ts). */
export type FoodUnit = Extract<
	UnitOption['input'],
	{ kind: 'mass' } | { kind: 'volume' } | { kind: 'serving' } | { kind: 'basis_serving' }
>;

/** Portion names that a count word can mean, folded. */
const SYNONYMS: Record<CountWord, string[]> = {
	slice: ['slice', 'dilim'],
	can: ['can', 'kutu', 'container'],
	bottle: ['bottle', 'sise'],
	glass: ['glass', 'bardak', 'cup'],
	container: ['container', 'kutu', 'kap', 'tub', 'pot', 'kase', 'cup'],
	package: ['package', 'paket', 'pack', 'packet', 'bar'],
	piece: ['piece', 'tane', 'adet', 'medium', 'each', 'whole'],
	portion: ['portion', 'porsiyon', 'serving', 'servis', 'tabak', 'plate'],
	// A handful has no fixed size: only a portion the food names so.
	handful: ['handful', 'avuc']
};
const words = (s: string) => fold(s).split(/[^a-z0-9]+/);

/** The food as the matcher sees it; a built-in one also answers to its portions' Turkish names. */
type MatchFood = QuantityModel & { servingLabel: string | null; origin?: string };

/** The words of each portion's names: as stored, and in Turkish as shown ("clove", "diş"; any food's "Bowl", "kase"). */
const portionWords = (food: MatchFood) =>
	food.servings.map((s) => {
		const turkish =
			(food.origin === 'curated' ? turkishPortion(s.name) : null) ?? genericPortion(s.name);
		return { serving: s, names: [s.name, ...(turkish ? [turkish] : [])].map(words) };
	});

/** "cups" → cups, cup; "berries" → berry; "boxes" → box. */
const singulars = (w: string) => [
	w,
	...(w.endsWith('s') ? [w.slice(0, -1)] : []),
	...(w.endsWith('es') ? [w.slice(0, -2)] : []),
	...(w.endsWith('ies') ? [`${w.slice(0, -3)}y`] : [])
];

/**
 * The food's own portion that a word names, singular or plural ("2 cups" → its "Cup", "3 scoops" → "Scoop (30 g)").
 * Matched after the food is found, so any portion name works, not only the count words the parser knows.
 */
export function portionNamed(word: string, food: MatchFood): FoodUnit | null {
	const dims = supportedDimensions(food);
	if (!dims.mass && !dims.volume) return null;
	// One word, or two said together ("yemek kaşığı"): the last may be plural.
	const said = fold(word)
		.split(/[^a-z0-9]+/)
		.filter(Boolean);
	if (!said.length) return null;
	const head = said.slice(0, -1);
	const forms = singulars(said[said.length - 1]);
	const names = (ws: string[]) =>
		ws.some(
			(w, i) =>
				forms.includes(w) && head.every((h, j) => ws[i - head.length + j] === h) && i >= head.length
		);
	const found = portionWords(food).find((p) => p.names.some(names));
	return found ? { kind: 'serving', servingId: found.serving.id } : null;
}

export function unitForFood(parsed: ParsedUnit | null, food: MatchFood): FoodUnit | null {
	if (!parsed) return null;
	const dims = supportedDimensions(food);
	if (parsed.kind === 'g') return dims.mass ? { kind: 'mass', unit: 'g' } : null;
	if (parsed.kind === 'ml') return dims.volume ? { kind: 'volume', unit: 'ml' } : null;

	const wanted = parsed.word ? SYNONYMS[parsed.word] : SYNONYMS.piece;
	const portion = portionWords(food).find((p) =>
		p.names.some((ws) => ws.some((w) => wanted.includes(w)))
	)?.serving;
	if (portion && (dims.mass || dims.volume)) return { kind: 'serving', servingId: portion.id };
	if (food.basis === 'serving') {
		const label = food.servingLabel ? words(food.servingLabel) : [];
		// "1 bar", "1 kutu": the food's own serving, when the word fits it or none was said.
		if (
			!parsed.word ||
			parsed.word === 'piece' ||
			parsed.word === 'portion' ||
			label.some((w) => wanted.includes(w))
		)
			return { kind: 'basis_serving' };
	}
	return null;
}

/**
 * The amount and unit to propose for a matched food, in a unit its amount sheet offers. A food named without an
 * amount ("I had a protein bar") is proposed as one of its own servings, which the person confirms or changes before
 * logging; a per-100 g food named without one is asked.
 */
export function proposeForFood(
	amount: number | null,
	parsed: ParsedUnit | null,
	food: MatchFood,
	/** Words after the number that name one of the food's portions ("2 cups"), found by `portionNamed`. */
	named?: string
): { unit: FoodUnit | null; amount: number | null } {
	const bare = amount === null && parsed === null && food.basis === 'serving';
	const proposed = offeredAmount(
		food,
		(named ? portionNamed(named, food) : null) ??
			unitForFood(bare ? { kind: 'count', word: null } : parsed, food),
		bare ? 1 : amount
	);
	return proposed as { unit: FoodUnit | null; amount: number | null };
}
