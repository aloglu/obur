// Converting a chosen amount and unit into a multiplier of a food's nutrient basis (docs/design.md,
// "Quantities and source values"). Never assumes 1 g/ml or invents a portion's mass: a conversion that needs a
// density or an unknown serving size returns undefined, and the interface asks instead.
import type { NutrientValue } from './nutrients.ts';

export type Basis = '100g' | '100ml' | 'serving';
export type Dimension = 'mass' | 'volume';

export interface FoodServing {
	id: string;
	name: string;
	/** The serving's size in grams or millilitres, as stated by the source or entered by the person. */
	amount: number;
	unit: 'g' | 'ml';
}

export interface QuantityModel {
	basis: Basis;
	/** For a per-serving basis: the size of one basis serving, when the source states it. */
	servingSize?: { amount: number; unit: 'g' | 'ml' } | null;
	servings: FoodServing[];
}

// Physical units with exact definitions. Household volume presets come from the database as millilitres.
export const MASS_UNITS = { g: 1, kg: 1000, oz: 28.349523125, lb: 453.59237 } as const;
export const VOLUME_UNITS = {
	ml: 1,
	l: 1000,
	us_cup: 236.5882365,
	metric_cup: 250,
	us_fl_oz: 29.5735295625,
	imp_fl_oz: 28.4130625
} as const;

export type Unit =
	| { kind: 'mass'; unit: keyof typeof MASS_UNITS }
	| { kind: 'volume'; unit: keyof typeof VOLUME_UNITS }
	/** A household measure such as su bardağı (200 ml): volume only. */
	| { kind: 'measure'; ml: number }
	/** One basis serving of a per-serving food. */
	| { kind: 'basis_serving' }
	/** A named portion of the food. */
	| { kind: 'serving'; servingId: string };

const physical = (unit: Unit): { dimension: Dimension; size: number } | undefined => {
	switch (unit.kind) {
		case 'mass':
			return { dimension: 'mass', size: MASS_UNITS[unit.unit] };
		case 'volume':
			return { dimension: 'volume', size: VOLUME_UNITS[unit.unit] };
		case 'measure':
			return { dimension: 'volume', size: unit.ml };
		default:
			return undefined;
	}
};

const dimensionOf = (u: 'g' | 'ml'): Dimension => (u === 'g' ? 'mass' : 'volume');

/**
 * Multiplier of the food's basis values for `amount` of `unit`, or undefined when the conversion is not known.
 * A per-100 g food has a multiplier of 1 for 100 g; a per-serving food has 1 for one serving.
 */
export function basisFactor(food: QuantityModel, amount: number, unit: Unit): number | undefined {
	if (!Number.isFinite(amount) || amount <= 0) return undefined;

	// Express the quantity as a physical amount, or as a count of basis servings.
	let quantity: { dimension: Dimension; size: number } | { servings: number } | undefined;
	if (unit.kind === 'basis_serving') {
		if (food.basis !== 'serving') return undefined;
		quantity = { servings: amount };
	} else if (unit.kind === 'serving') {
		const s = food.servings.find((x) => x.id === unit.servingId);
		if (!s) return undefined;
		quantity = { dimension: dimensionOf(s.unit), size: s.amount * amount };
	} else {
		const p = physical(unit);
		quantity = p && { dimension: p.dimension, size: p.size * amount };
	}
	if (!quantity) return undefined;

	if ('servings' in quantity) return quantity.servings;
	if (food.basis === '100g') return quantity.dimension === 'mass' ? quantity.size / 100 : undefined;
	if (food.basis === '100ml')
		return quantity.dimension === 'volume' ? quantity.size / 100 : undefined;
	// Per-serving food measured physically: needs the stated serving size in the same dimension.
	const size = food.servingSize;
	if (!size || dimensionOf(size.unit) !== quantity.dimension || size.amount <= 0) return undefined;
	return quantity.size / size.amount;
}

/** The kinds of unit a food supports, for offering only valid choices. */
export function supportedDimensions(food: QuantityModel): { mass: boolean; volume: boolean } {
	if (food.basis === '100g') return { mass: true, volume: false };
	if (food.basis === '100ml') return { mass: false, volume: true };
	const unit = food.servingSize?.unit;
	return { mass: unit === 'g', volume: unit === 'ml' };
}

/** Scales nutrient values by a basis multiplier. Qualifiers carry over: a bound stays a bound. */
export function scaleNutrients(values: NutrientValue[], factor: number): NutrientValue[] {
	return values.map((v) => ({ ...v, value: Math.round(v.value * factor * 10_000) / 10_000 }));
}
