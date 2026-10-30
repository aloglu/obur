// Pure diary rules: scaling a snapshot, summing a day with partial coverage, and choosing the diary day.
import type {
	DayTotals,
	DiaryEntry,
	EntryNutrients,
	FoodSnapshot,
	SnapshotUnit
} from './diary-types.ts';
import type { FoodDetail } from './food-types.ts';
import { NUTRIENT_CODES, type NutrientValue } from './nutrients.ts';
import { basisFactor, scaleNutrients, type Unit } from './quantity.ts';

/** What a diary entry, saved meal item or recipe ingredient keeps of a food: enough to show and re-scale it. */
export function snapshotOf(food: FoodDetail): FoodSnapshot {
	return {
		name: food.name,
		brand: food.brand,
		basis: food.basis,
		servingLabel: food.servingLabel,
		servingSize: food.servingSize ?? null,
		servings: food.servings.map(({ id, name, amount, unit }) => ({ id, name, amount, unit })),
		basisNutrients: food.nutrients
	};
}

/** Converts a stored unit back to a conversion unit. */
export function toUnit(unit: SnapshotUnit): Unit {
	if (unit.kind === 'measure') return { kind: 'measure', ml: unit.ml };
	if (unit.kind === 'serving') return { kind: 'serving', servingId: unit.servingId };
	return unit;
}

/** Nutrients for `amount` of `unit` of a snapshot, or undefined if the conversion is not known. */
export function snapshotNutrients(
	food: FoodSnapshot,
	amount: number,
	unit: SnapshotUnit
): EntryNutrients | undefined {
	const factor = basisFactor(
		{ basis: food.basis, servingSize: food.servingSize, servings: food.servings },
		amount,
		toUnit(unit)
	);
	if (factor === undefined) return undefined;
	return toEntryNutrients(scaleNutrients(food.basisNutrients, factor));
}

export function toEntryNutrients(values: NutrientValue[]): EntryNutrients {
	return Object.fromEntries(
		values.map((v) => [v.code, { value: v.value, qualifier: v.qualifier }])
	);
}

/**
 * Totals for a set of entries. A nutrient missing from an entry is counted as unknown, never as zero
 * (docs/design.md, "Quantities and source values").
 */
export function dayTotals(entries: Pick<DiaryEntry, 'nutrients'>[]): DayTotals {
	const totals: DayTotals = {};
	for (const code of NUTRIENT_CODES) {
		let value = 0;
		let unknown = 0;
		let approximate = false;
		let known = 0;
		for (const e of entries) {
			const n = e.nutrients[code];
			if (!n) {
				unknown += 1;
				continue;
			}
			known += 1;
			value += n.value;
			if (n.qualifier === 'less_than' || n.qualifier === 'estimate') approximate = true;
		}
		if (known > 0) totals[code] = { value: Math.round(value * 100) / 100, unknown, approximate };
	}
	return totals;
}

export interface CarbohydrateDay {
	/** Entries stating carbohydrate excluding fibre (EU/Turkish labels): the figure the dashboard uses. */
	stated: { value: number; entries: number; approximate: boolean };
	/** Entries with only a carbohydrate of unstated definition (imported from LoseIt). */
	unstated: { value: number; entries: number; approximate: boolean };
	/** Entries with neither. */
	unknown: number;
}

/**
 * A day's carbohydrate, keeping the two definitions apart (they are never added together): entries with the
 * excluding-fibre value count there; entries with only an unstated-definition value count separately.
 */
export function carbohydrateDay(entries: Pick<DiaryEntry, 'nutrients'>[]): CarbohydrateDay {
	const out: CarbohydrateDay = {
		stated: { value: 0, entries: 0, approximate: false },
		unstated: { value: 0, entries: 0, approximate: false },
		unknown: 0
	};
	for (const e of entries) {
		const n = e.nutrients.carbohydrate_excl_fibre ?? e.nutrients.carbohydrate_unspecified;
		const part = e.nutrients.carbohydrate_excl_fibre ? out.stated : n ? out.unstated : null;
		if (!part || !n) {
			out.unknown += 1;
			continue;
		}
		part.value += n.value;
		part.entries += 1;
		if (n.qualifier === 'less_than' || n.qualifier === 'estimate') part.approximate = true;
	}
	out.stated.value = Math.round(out.stated.value * 100) / 100;
	out.unstated.value = Math.round(out.unstated.value * 100) / 100;
	return out;
}

/** YYYY-MM-DD of an instant in an IANA zone. */
export function localDate(instant: Date, zone: string): string {
	return new Intl.DateTimeFormat('en-CA', {
		timeZone: zone,
		year: 'numeric',
		month: '2-digit',
		day: '2-digit'
	}).format(instant);
}

export function addDays(date: string, days: number): string {
	const d = new Date(`${date}T12:00:00Z`);
	d.setUTCDate(d.getUTCDate() + days);
	return d.toISOString().slice(0, 10);
}

/** Before this local hour, logging "today" offers the previous diary day (docs/design.md). */
export const LATE_NIGHT_CUTOFF_HOUR = 4;

export function isLateNight(instant: Date, zone: string): boolean {
	const hour = Number(
		new Intl.DateTimeFormat('en-GB', { timeZone: zone, hour: '2-digit', hourCycle: 'h23' }).format(
			instant
		)
	);
	return hour < LATE_NIGHT_CUTOFF_HOUR;
}

export function isValidZone(zone: string): boolean {
	try {
		new Intl.DateTimeFormat('en', { timeZone: zone });
		return /^[A-Za-z_]+(\/[A-Za-z0-9_+-]+)*$/.test(zone) || zone === 'UTC';
	} catch {
		return false;
	}
}

export function isIsoDate(value: string): boolean {
	if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
	const d = new Date(`${value}T00:00:00Z`);
	return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === value;
}

/** The meal a new entry defaults to, by local time of day, when no meal was chosen. */
export function defaultMeal(
	instant: Date,
	zone: string
): 'breakfast' | 'lunch' | 'dinner' | 'snacks' {
	const [h, min] = new Intl.DateTimeFormat('en-GB', {
		timeZone: zone,
		hour: '2-digit',
		minute: '2-digit',
		hourCycle: 'h23'
	})
		.format(instant)
		.split(':')
		.map(Number);
	const t = h * 60 + min;
	if (t >= 4 * 60 && t < 10 * 60 + 30) return 'breakfast';
	if (t >= 11 * 60 && t < 15 * 60) return 'lunch';
	if (t >= 17 * 60 && t < 21 * 60 + 30) return 'dinner';
	return 'snacks';
}
