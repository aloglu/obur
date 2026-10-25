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
	origin: string;
	archived: boolean;
	version: number;
	/** Created by the signed-in person. */
	mine: boolean;
	/** The signed-in person may edit it (creator, or an admin for shared foods). */
	editable: boolean;
	derivedFrom: string | null;
	nutrients: NutrientValue[];
	servings: FoodServing[];
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
}
