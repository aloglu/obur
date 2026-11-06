// A typed or spoken sentence as the server understood it, for the confirmation sheet. Nothing here is saved until the
// person confirms; foods come from the catalog and are shown with their candidates.
import type { Meal } from './diary-types.ts';
import type { FoodDetail, FoodSearchResult } from './food-types.ts';
import type { UnitOption } from './unit-options.ts';

/** The word the person used for a count ("slice", "can"), or g/ml, for display when no unit could be chosen. */
export type SaidUnit =
	| 'g'
	| 'ml'
	| 'slice'
	| 'can'
	| 'bottle'
	| 'glass'
	| 'container'
	| 'package'
	| 'piece'
	| 'portion'
	| 'handful'
	| null;

export type EntryItem =
	| {
			kind: 'food';
			/** The words searched for. */
			text: string;
			candidates: FoodSearchResult[];
			/** The first candidate, in full, so the card can show units and kcal at once. */
			food: FoodDetail | null;
			amount: number | null;
			/** One of the food's units, or null when the person must choose. */
			unit: UnitOption['input'] | null;
			said: SaidUnit;
			vague: boolean;
	  }
	| { kind: 'quick'; kcal: number; description: string | null }
	/** ml is null when the amount needs a choice ("bir şişe su"). */
	| { kind: 'water'; ml: number | null; amount: number | null; said: SaidUnit }
	| { kind: 'weight'; kg: number }
	| { kind: 'activity'; kcal: number; note: string | null };

export interface ParsedEntry {
	/** What was typed or heard, shown as editable text. */
	heard: string;
	/** The day: from the sentence, else the day being viewed. Never in the future. */
	date: string;
	/** The meal, when the sentence said one. */
	meal: Meal | null;
	items: EntryItem[];
}

/** What the confirmation sheet saved, for the toast and its Undo (each path deletes one record). */
export interface LoggedEntry {
	count: number;
	date: string;
	undo: string[];
	/** The first diary entry, to highlight. */
	firstEntryId: string | null;
	/** Foods nothing was found for, left out of what was logged. */
	skipped?: string[];
}
