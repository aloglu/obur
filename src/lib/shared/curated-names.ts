// Turkish names for the built-in USDA foods and their portions (docs/design.md, "Built-in USDA foods"). The stored
// names stay English; a built-in food (and a diary copy of one, `curated` on the snapshot) shows these in Turkish.
// Names say what the values are (feta stays "Feta peyniri"); Turkish search words are the foods' aliases.
// Weights stay as USDA measured them; the cup stays USDA's, labelled with its size.
import { getLocale } from '#lib/paraglide/runtime.js';

import { NAMES, turkishPortion } from './curated-names-tr.ts';

/** A built-in food's name in the interface language; any other food's name exactly as typed. */
export function foodName(name: string, curated: boolean | undefined): string {
	if (!curated || getLocale() !== 'tr') return name;
	return NAMES[name] ?? name;
}

/** A built-in food's portion name in the interface language; any other portion's name as typed. */
export function portionName(name: string, curated: boolean | undefined): string {
	if (!curated || getLocale() !== 'tr') return name;
	return turkishPortion(name) ?? name;
}

/** For tests: every name and portion the built-in list has should have its Turkish. */
export const hasTurkish = (english: string, kind: 'name' | 'portion'): boolean =>
	kind === 'name' ? english in NAMES : turkishPortion(english) !== null;

/** Whether a food, a search result or a diary copy is a built-in one. */
export const isCurated = (f: { curated?: boolean; origin?: string }): boolean =>
	f.curated === true || f.origin === 'curated';

/** "Brand name", with a built-in food's name in the interface language. */
export const fullFoodName = (f: {
	name: string;
	brand: string | null;
	curated?: boolean;
	origin?: string;
}): string => `${f.brand ? `${f.brand} ` : ''}${foodName(f.name, isCurated(f))}`;
