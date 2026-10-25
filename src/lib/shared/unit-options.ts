// The unit choices an amount sheet offers for a food: only units the food can actually be converted from
// (docs/design.md, "Quantities and source values"). Shared by logging and editing.
import type { SnapshotUnit } from './diary-types.ts';
import { formatDecimal } from './numbers.ts';
import { supportedDimensions, type QuantityModel } from './quantity.ts';

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

export function unitOptions(
	food: QuantityModel & { servingLabel: string | null },
	measures: MeasureOption[]
): UnitOption[] {
	const dims = supportedDimensions(food);
	const options: UnitOption[] = [];
	if (food.basis === 'serving') {
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
				label: `${s.name} (${formatDecimal(s.amount, ',', 1)} ${s.unit})`,
				input: { kind: 'serving', servingId: s.id },
				defaultAmount: 1
			});
		}
	}
	if (dims.mass)
		options.push({ key: 'g', label: 'g', input: { kind: 'mass', unit: 'g' }, defaultAmount: 100 });
	if (dims.volume) {
		options.push({
			key: 'ml',
			label: 'ml',
			input: { kind: 'volume', unit: 'ml' },
			defaultAmount: 200
		});
		for (const m of measures) {
			options.push({
				key: `measure:${m.code}`,
				label: `${m.name} (${formatDecimal(m.ml, ',', 0)} ml)`,
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
