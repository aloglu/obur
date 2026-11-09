// What the Scan sheet read, handed to the page that shows it as a food form (Check the label). Kept in memory only:
// the photo stays on this phone as an object URL and is never stored or sent again.
import type { FoodDetail } from '#lib/shared/food-types.ts';
import type { LabelNote } from '#lib/shared/label-notes.ts';
import type { NutrientValue } from '#lib/shared/nutrients.ts';

export interface LabelProposal {
	basis: '100g' | '100ml' | 'serving' | null;
	portion: { name: string; amount: number; unit: 'g' | 'ml' } | null;
	nutrients: NutrientValue[];
	layout: 'table' | 'text' | 'none';
	notes: LabelNote[];
}

export interface ScanResult {
	proposal: LabelProposal;
	/** The photo looked blurry: values it read may be misread. */
	blurry: boolean;
	/** The photo as an object URL, to show beside the form; null when filling in by hand. */
	photo: string | null;
}

/** Nothing read: the same form, empty ("Fill in by hand"). */
export const BY_HAND: ScanResult = {
	proposal: { basis: '100g', portion: null, nutrients: [], layout: 'none', notes: [] },
	blurry: false,
	photo: null
};

let pending: ScanResult | null = null;

export function handOver(result: ScanResult) {
	pending = result;
}

/** The result waiting for Check the label, once. */
export function takeOver(): ScanResult | null {
	const result = pending;
	pending = null;
	return result;
}

/**
 * A proposal as the food form's starting values; the name and brand are typed by the person. A per-serving
 * column's size is used only when the values are per serving (it is then the basis). It is never added as a
 * portion: that header is the label's least reliable line, and a wrong weight would skew every later log of it
 * (owner, 2026-11-09). Portions are the person's to add.
 */
export function proposalFood(p: LabelProposal): FoodDetail {
	const serving = p.basis === 'serving';
	return {
		id: '',
		name: '',
		brand: null,
		visibility: 'shared',
		basis: p.basis ?? '100g',
		servingLabel: serving ? (p.portion?.name ?? '') : null,
		servingSize: serving && p.portion ? { amount: p.portion.amount, unit: p.portion.unit } : null,
		barcode: null,
		icon: null,
		origin: 'label_scan',
		curatedDataset: null,
		archived: false,
		version: 0,
		mine: true,
		editable: true,
		derivedFrom: null,
		// A stated sodium makes the form treat the label as American (carbohydrate as total); with salt there too,
		// as on Turkish and EU labels, salt is enough.
		nutrients: p.nutrients.some((n) => n.code === 'salt')
			? p.nutrients.filter((n) => n.code !== 'sodium')
			: p.nutrients,
		servings: [],
		warnings: []
	};
}
