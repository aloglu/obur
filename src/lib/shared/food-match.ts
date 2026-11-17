// "Already in your foods" (docs/design.md): when a food about to be saved or imported is the same as one the person
// already has. The same name and brand after folding (case, accents, Turkish letters, word order), and, when both
// state calories on a comparable basis, calories within 10 % or 10 kcal. A match is only ever offered, never applied
// silently.
import { foldForSearch } from './search-text.ts';

export interface MatchableFood {
	name: string;
	brand: string | null;
	basis: '100g' | '100ml' | 'serving';
	servingSize: { amount: number; unit: 'g' | 'ml' } | null;
	/** What one serving is ("1 slice"), for a per-serving food. */
	servingLabel?: string | null;
	/** Energy per basis; null when unknown. */
	kcal: number | null;
}

/** Name and brand as one key that ignores case, accents, Turkish letters and word order. */
export function matchKey(name: string, brand: string | null): string {
	const words = foldForSearch(`${brand ?? ''} ${name}`)
		.split(' ')
		.filter(Boolean);
	return [...new Set(words)].sort().join(' ');
}

/** Energy per 100 g or 100 ml, when the food states it on a basis that converts to one. */
function per100(f: MatchableFood): { unit: 'g' | 'ml'; kcal: number } | null {
	if (f.kcal === null) return null;
	if (f.basis === '100g') return { unit: 'g', kcal: f.kcal };
	if (f.basis === '100ml') return { unit: 'ml', kcal: f.kcal };
	if (f.servingSize)
		return { unit: f.servingSize.unit, kcal: (f.kcal / f.servingSize.amount) * 100 };
	return null;
}

/**
 * Whether the two foods' calories agree: true or false when they can be compared (per 100 g, per 100 ml, or per
 * serving of a known size), null when they can't.
 */
export function caloriesAgree(a: MatchableFood, b: MatchableFood): boolean | null {
	const [x, y] = [per100(a), per100(b)];
	let pair: [number, number] | null = x && y && x.unit === y.unit ? [x.kcal, y.kcal] : null;
	// Two per-serving foods without a size compare when the serving is described the same way.
	if (
		!pair &&
		a.basis === 'serving' &&
		b.basis === 'serving' &&
		!a.servingSize &&
		!b.servingSize &&
		foldForSearch(a.servingLabel ?? '') === foldForSearch(b.servingLabel ?? '')
	)
		pair = a.kcal !== null && b.kcal !== null ? [a.kcal, b.kcal] : null;
	if (!pair) return null;
	const [p, q] = pair;
	return Math.abs(p - q) <= Math.max(10, 0.1 * Math.max(p, q));
}

/** The same food: the same name and brand, and calories that don't disagree. */
export function sameFood(a: MatchableFood, b: MatchableFood): boolean {
	return matchKey(a.name, a.brand) === matchKey(b.name, b.brand) && caloriesAgree(a, b) !== false;
}
