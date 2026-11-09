// What the Scan sheet read, handed to the page that shows it as a food form (Check the label). Kept in memory only:
// the photo stays on this phone as an object URL and is never stored or sent again.
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
