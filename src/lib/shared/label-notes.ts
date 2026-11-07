// What the label parser decided while reading a photo (server/modules/label-parser), shown as notes on Check the
// label (ui/food/ScanNotes.svelte). Shared so the page can type them; the parser is the only producer.
import type { NutrientCode } from './nutrients.ts';

export type LabelNote =
	/** Which column the values come from, and what was passed over. */
	| {
			kind: 'columns';
			used: '100g' | '100ml' | 'serving';
			skippedServing: boolean;
			skippedRi: boolean;
			/** A per-serving size offered as a portion. */
			portion: boolean;
	  }
	/** The basis came from the table's title, not a column. */
	| { kind: 'basis_from_title'; basis: '100g' | '100ml' }
	/** Read from running text rather than a table. */
	| { kind: 'running_text' }
	/** Numbers no food can have for the basis, left out so they stay unknown. */
	| { kind: 'dropped'; codes: NutrientCode[] }
	/** Salt or sodium written in milligrams, given in grams. */
	| { kind: 'converted_mg'; codes: NutrientCode[] };
