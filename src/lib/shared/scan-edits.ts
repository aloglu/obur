// How much a person changed a label scan's proposal before saving the food (owner's choice 2026-10-31, docs/design.md
// "OCR and barcode capture"): counts only, never the values or the photo. Compared with the form's starting values,
// so the form's own choices (salt or sodium) don't count as edits. A value counts as the same when its number and
// "less than" match: the form saves every value as reported or less than.
import * as v from 'valibot';
import type { NutrientValue } from './nutrients.ts';

export interface ScanEdits {
	/** Values the scan proposed. */
	proposed: number;
	/** Proposed values saved with a different number or "less than". */
	changed: number;
	/** Proposed values left out of the saved food. */
	removed: number;
	/** Values saved that the scan didn't propose. */
	added: number;
	/** The scan found the basis (per 100 g, 100 ml or serving). */
	basisKnown: boolean;
	/** The basis or the serving size was changed. */
	basisChanged: boolean;
}

const MAX = 100;
const Count = v.pipe(v.number(), v.integer(), v.minValue(0), v.maxValue(MAX));
export const ScanEditsInput = v.object({
	proposed: Count,
	changed: Count,
	removed: Count,
	added: Count,
	basisKnown: v.boolean(),
	basisChanged: v.boolean()
});

interface Basis {
	basis: string;
	servingSize?: { amount: number; unit: string } | null;
}

const same = (a: NutrientValue, b: NutrientValue) =>
	a.value === b.value && (a.qualifier === 'less_than') === (b.qualifier === 'less_than');

export function scanEdits(
	proposal: Basis & { nutrients: NutrientValue[]; basisKnown: boolean },
	saved: Basis & { nutrients: NutrientValue[] }
): ScanEdits {
	const kept = new Map(saved.nutrients.map((n) => [n.code, n]));
	const proposedCodes = new Set(proposal.nutrients.map((n) => n.code));
	let changed = 0;
	let removed = 0;
	for (const n of proposal.nutrients) {
		const after = kept.get(n.code);
		if (!after) removed++;
		else if (!same(n, after)) changed++;
	}
	const sizeOf = (b: Basis) =>
		b.servingSize ? `${b.servingSize.amount} ${b.servingSize.unit}` : '';
	return {
		proposed: proposal.nutrients.length,
		changed,
		removed,
		added: saved.nutrients.filter((n) => !proposedCodes.has(n.code)).length,
		basisKnown: proposal.basisKnown,
		basisChanged: proposal.basis !== saved.basis || sizeOf(proposal) !== sizeOf(saved)
	};
}
