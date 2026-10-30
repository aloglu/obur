// Which of a food's own units a parsed amount refers to. Pure. A count word is matched to the food's portions by name
// in both languages ("3 dilim" → its "slice" portion); a bare count ("bir muz") takes a medium portion or the food's
// own serving. Grams and millilitres need a food that converts from them. Anything else is left for the person to
// choose: no weight or density is ever assumed.
import { supportedDimensions, type QuantityModel } from '../../../shared/quantity.ts';
import type { UnitOption } from '../../../shared/unit-options.ts';
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

export function unitForFood(
	parsed: ParsedUnit | null,
	food: QuantityModel & { servingLabel: string | null }
): FoodUnit | null {
	if (!parsed) return null;
	const dims = supportedDimensions(food);
	if (parsed.kind === 'g') return dims.mass ? { kind: 'mass', unit: 'g' } : null;
	if (parsed.kind === 'ml') return dims.volume ? { kind: 'volume', unit: 'ml' } : null;

	const wanted = parsed.word ? SYNONYMS[parsed.word] : SYNONYMS.piece;
	const portion = food.servings.find((s) => words(s.name).some((w) => wanted.includes(w)));
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
