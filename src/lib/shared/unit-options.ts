// The unit choices an amount sheet offers for a food: only units the food can actually be converted from
// (docs/design.md, "Quantities and source values"). Shared by logging and editing.
import type { SnapshotUnit } from './diary-types.ts';
import { formatDecimal } from './numbers.ts';
import { supportedDimensions, type QuantityModel } from './quantity.ts';
import { isCurated, portionName } from '#lib/shared/curated-names.ts';
import { measureName } from '#lib/shared/measure-names.ts';

export interface UnitOption {
	key: string;
	label: string;
	/** The unit as the API accepts it. */
	input:
		| { kind: 'mass'; unit: 'g' }
		| { kind: 'volume'; unit: 'ml' }
		| { kind: 'measure'; code: string }
		| { kind: 'basis_serving' }
		| { kind: 'serving'; servingId: string };
	defaultAmount: number;
}

export interface MeasureOption {
	code: string;
	name: string;
	ml: number;
}

/** True when a serving's label only restates its size ("100 g" for 100 g), which the g or ml option already covers. */
function labelRestatesSize(food: QuantityModel & { servingLabel: string | null }): boolean {
	if (!food.servingSize || food.servingLabel === null) return false;
	const plain = (s: string) => s.toLowerCase().replace(/\s+/g, '').replace(',', '.');
	return (
		plain(food.servingLabel) ===
		plain(`${Number(food.servingSize.amount.toFixed(4))}${food.servingSize.unit}`)
	);
}

/**
 * A proposed amount and unit as the amount sheet offers them (typed and spoken entries). A food's own serving that
 * the sheet hides, because its label only restates its size ("40 g"), becomes that size in g or ml: "two" of it is
 * 80 g. Nothing is converted that the food itself does not state.
 */
export function offeredAmount(
	food: QuantityModel & { servingLabel: string | null },
	unit: UnitOption['input'] | null,
	amount: number | null
): { unit: UnitOption['input'] | null; amount: number | null } {
	if (unit?.kind !== 'basis_serving' || !labelRestatesSize(food)) return { unit, amount };
	const size = food.servingSize!;
	return {
		unit: size.unit === 'g' ? { kind: 'mass', unit: 'g' } : { kind: 'volume', unit: 'ml' },
		amount: amount === null ? null : Number((amount * size.amount).toFixed(4))
	};
}

/** `keepBasis` keeps the basis serving even when redundant, so an entry logged in it can still be edited. */
export function unitOptions(
	food: QuantityModel & { servingLabel: string | null; curated?: boolean; origin?: string },
	measures: MeasureOption[],
	keepBasis = false
): UnitOption[] {
	const dims = supportedDimensions(food);
	const options: UnitOption[] = [];
	// When the serving is hidden, its size becomes the default physical amount.
	const hidden = food.basis === 'serving' && !keepBasis && labelRestatesSize(food);
	const physicalDefault = (unit: 'g' | 'ml', fallback: number) =>
		hidden && food.servingSize?.unit === unit ? food.servingSize.amount : fallback;
	if (food.basis === 'serving' && !hidden) {
		options.push({
			key: 'basis',
			label: food.servingLabel ?? '1',
			input: { kind: 'basis_serving' },
			defaultAmount: 1
		});
	}
	for (const s of food.servings) {
		if ((s.unit === 'g' && dims.mass) || (s.unit === 'ml' && dims.volume)) {
			options.push({
				key: `serving:${s.id}`,
				label: `${portionName(s.name, isCurated(food))} (${formatDecimal(s.amount, 1)} ${s.unit})`,
				input: { kind: 'serving', servingId: s.id },
				defaultAmount: 1
			});
		}
	}
	if (dims.mass)
		options.push({
			key: 'g',
			label: 'g',
			input: { kind: 'mass', unit: 'g' },
			defaultAmount: physicalDefault('g', 100)
		});
	if (dims.volume) {
		options.push({
			key: 'ml',
			label: 'ml',
			input: { kind: 'volume', unit: 'ml' },
			defaultAmount: physicalDefault('ml', 200)
		});
		for (const m of measures) {
			options.push({
				key: `measure:${m.code}`,
				label: `${measureName(m.code, m.name)} (${formatDecimal(m.ml, 0)} ml)`,
				input: { kind: 'measure', code: m.code },
				defaultAmount: 1
			});
		}
	}
	return options;
}

/** The option matching a stored unit, for editing an entry. */
export function optionKeyFor(unit: SnapshotUnit): string {
	switch (unit.kind) {
		case 'basis_serving':
			return 'basis';
		case 'serving':
			return `serving:${unit.servingId}`;
		case 'measure':
			return `measure:${unit.code}`;
		default:
			return unit.unit;
	}
}

/** The stored unit an option means for a food's portions, for previews; undefined when it no longer exists. */
export function snapshotUnitFor(
	input: UnitOption['input'],
	servings: { id: string; name: string; amount: number; unit: 'g' | 'ml' }[],
	measures: MeasureOption[]
): SnapshotUnit | undefined {
	if (input.kind === 'measure') {
		const m = measures.find((x) => x.code === input.code);
		return m && { kind: 'measure', code: m.code, name: m.name, ml: m.ml };
	}
	if (input.kind === 'serving') {
		const s = servings.find((x) => x.id === input.servingId);
		return s && { kind: 'serving', servingId: s.id, name: s.name, amount: s.amount, unit: s.unit };
	}
	return input;
}
