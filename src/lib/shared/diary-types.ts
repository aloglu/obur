// Diary shapes shared by the server and the interface (docs/design.md, "Diary and logging rules").
import type { Basis, FoodServing, Unit } from './quantity.ts';
import type { NutrientCode, NutrientValue, Qualifier } from './nutrients.ts';

export const MEALS = ['breakfast', 'lunch', 'dinner', 'snacks'] as const;
export type Meal = (typeof MEALS)[number];

/** A stored unit: like Unit, but household measures keep their name and size. */
export type SnapshotUnit =
	| Exclude<Unit, { kind: 'measure' } | { kind: 'serving' }>
	| { kind: 'measure'; code: string; name: string; ml: number }
	| { kind: 'serving'; servingId: string; name: string; amount: number; unit: 'g' | 'ml' };

/** Everything needed to show and re-scale an entry without the current catalog. */
export interface FoodSnapshot {
	name: string;
	brand: string | null;
	basis: Basis;
	servingLabel: string | null;
	servingSize: { amount: number; unit: 'g' | 'ml' } | null;
	/** The portions available when logged, so an amount can be changed in any of them later. */
	servings: FoodServing[];
	/** Nutrients per basis, as the food had them when logged. */
	basisNutrients: NutrientValue[];
}

export type EntryNutrients = Partial<Record<NutrientCode, { value: number; qualifier: Qualifier }>>;

export interface DiaryEntry {
	id: string;
	localDate: string;
	meal: Meal;
	zone: string;
	kind: 'food' | 'quick';
	foodId: string | null;
	/** Food entries: the food as logged. */
	food: FoodSnapshot | null;
	amount: number | null;
	unit: SnapshotUnit | null;
	/** Quick adds: the person's description. */
	description: string | null;
	nutrients: EntryNutrients;
	revision: number;
	createdAt: string;
	/** Not yet confirmed by the server (offline queue). */
	pending?: boolean;
}

export interface NutrientTotal {
	/** Sum of known values. */
	value: number;
	/** Entries for which the nutrient is unknown, so the total is partial. */
	unknown: number;
	/** Some contributing values are bounds or estimates. */
	approximate: boolean;
}

export type DayTotals = Partial<Record<NutrientCode, NutrientTotal>>;
