// Editable food items for the saved meal and recipe editors: a kept item (re-scaled from its own snapshot) or a new
// food, with the unit as a chip option. Only a change is sent, so the server re-scales nothing it need not.
import { snapshotNutrients } from '#lib/shared/diary-rules.ts';
import type { EntryNutrients, FoodSnapshot, SnapshotUnit } from '#lib/shared/diary-types.ts';
import type { FoodDetail } from '#lib/shared/food-types.ts';
import { quantityText } from '#lib/shared/format.ts';
import type { NutrientValue } from '#lib/shared/nutrients.ts';
import { formatDecimal, parseDecimal } from '#lib/shared/numbers.ts';
import {
	optionKeyFor,
	snapshotUnitFor,
	unitOptions,
	type MeasureOption,
	type UnitOption
} from '#lib/shared/unit-options.ts';

export interface Draft {
	key: string;
	/** A kept item's ID, or the new food's. */
	keptId?: string;
	foodId?: string;
	kind: 'food' | 'quick';
	name: string;
	/** Below the name for quick items ("Quick add"). */
	note?: string;
	snapshot: FoodSnapshot | null;
	amountText: string;
	optionKey: string;
	startAmount?: number | null;
	startKey?: string;
	startUnit?: SnapshotUnit | null;
	stored: EntryNutrients;
}

const displayName = (s: { name: string; brand: string | null }) =>
	`${s.brand ? `${s.brand} ` : ''}${s.name}`;

/** A kept item as the editor starts with it. */
export function keptDraft(i: {
	id: string;
	kind?: 'food' | 'quick';
	food: FoodSnapshot | null;
	amount: number | null;
	unit: SnapshotUnit | null;
	description?: string | null;
	nutrients: EntryNutrients;
	quickName?: string;
}): Draft {
	const key = i.unit ? optionKeyFor(i.unit) : '';
	const kind = i.kind ?? 'food';
	return {
		key: i.id,
		keptId: i.id,
		kind,
		name: kind === 'quick' ? (i.description ?? i.quickName ?? '') : displayName(i.food!),
		snapshot: i.food,
		amountText: i.amount !== null ? formatDecimal(i.amount, ',', 2) : '',
		optionKey: key,
		startAmount: i.amount,
		startKey: key,
		startUnit: i.unit,
		stored: i.nutrients
	};
}

/** A food just picked in the Add food sheet. */
export function newDraft(food: FoodDetail, amount: number, option: UnitOption): Draft {
	return {
		key: crypto.randomUUID(),
		foodId: food.id,
		kind: 'food',
		name: displayName(food),
		snapshot: {
			name: food.name,
			brand: food.brand,
			basis: food.basis,
			servingLabel: food.servingLabel,
			servingSize: food.servingSize ?? null,
			servings: food.servings,
			basisNutrients: food.nutrients,
			icon: food.icon
		},
		amountText: formatDecimal(amount, ',', 2),
		optionKey: option.key,
		stored: {}
	};
}

export const optionsFor = (d: Draft, measures: MeasureOption[]): UnitOption[] =>
	d.snapshot ? unitOptions(d.snapshot, measures, d.startUnit?.kind === 'basis_serving') : [];

function unitOf(d: Draft, measures: MeasureOption[]): SnapshotUnit | undefined {
	const option = optionsFor(d, measures).find((o) => o.key === d.optionKey);
	if (option && d.snapshot) return snapshotUnitFor(option.input, d.snapshot.servings, measures);
	// A stored unit the chips no longer offer (kg, say) stays usable while unchanged.
	return d.optionKey === d.startKey ? (d.startUnit ?? undefined) : undefined;
}

/** The item's nutrients as edited; undefined when the amount or unit can't be used. */
export function nutrientsOf(d: Draft, measures: MeasureOption[]): EntryNutrients | undefined {
	if (d.kind === 'quick' || !d.snapshot) return d.stored;
	const amount = parseDecimal(d.amountText);
	if (amount === undefined || amount <= 0) return undefined;
	const unit = unitOf(d, measures);
	return unit && snapshotNutrients(d.snapshot, amount, unit);
}

export function quantityOf(d: Draft, measures: MeasureOption[]): string {
	const amount = parseDecimal(d.amountText);
	const unit = unitOf(d, measures) ?? d.startUnit;
	return amount !== undefined && unit
		? quantityText(amount, unit, d.snapshot?.servingLabel ?? null)
		: '—';
}

export const asValues = (n: EntryNutrients | undefined): NutrientValue[] | undefined =>
	n && (Object.entries(n).map(([code, v]) => ({ code, ...v })) as NutrientValue[]);

/** True when the item differs from how it was saved. */
export const changed = (d: Draft) =>
	!d.keptId ||
	d.optionKey !== d.startKey ||
	parseDecimal(d.amountText) !== (d.startAmount ?? undefined);

/** The item as the save API takes it; `idField` names the kept item's ID field. */
export function payloadOf(d: Draft, measures: MeasureOption[], idField: 'itemId' | 'ingredientId') {
	const option = optionsFor(d, measures).find((o) => o.key === d.optionKey);
	const amount = parseDecimal(d.amountText)!;
	if (!d.keptId) return { foodId: d.foodId!, amount, unit: option!.input };
	if (d.kind === 'quick') return { [idField]: d.keptId };
	const unitChanged = d.optionKey !== d.startKey;
	return {
		[idField]: d.keptId,
		...(amount !== d.startAmount || unitChanged ? { amount } : {}),
		...(unitChanged && option ? { unit: option.input } : {})
	};
}
