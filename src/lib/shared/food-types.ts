// Shapes of foods as the API returns them. Shared by the server and the interface.
import type { FoodWarning } from './food-checks.ts';
import type { NutrientValue } from './nutrients.ts';
import type { FoodServing, QuantityModel } from './quantity.ts';

export interface FoodDetail extends QuantityModel {
	id: string;
	name: string;
	brand: string | null;
	visibility: 'private' | 'shared';
	servingLabel: string | null;
	barcode: string | null;
	/** The chosen icon; null shows the one the name suggests. */
	icon: string | null;
	origin: string;
	/** Curated foods: the reference dataset the values come from. */
	curatedDataset: 'sr_legacy' | 'foundation' | null;
	archived: boolean;
	version: number;
	/** Created by the signed-in person. */
	mine: boolean;
	/** The signed-in person may edit it (creator, or an admin for shared foods). */
	editable: boolean;
	derivedFrom: string | null;
	nutrients: NutrientValue[];
	/** With where each portion's size comes from (not part of diary snapshots). */
	servings: (FoodServing & { source: 'label' | 'user' | 'estimate' | 'reference' })[];
	warnings: FoodWarning[];
}

export interface FoodSearchResult {
	id: string;
	name: string;
	brand: string | null;
	basis: QuantityModel['basis'];
	servingLabel: string | null;
	visibility: 'private' | 'shared';
	mine: boolean;
	kcal: number | null;
	icon: string | null;
}
