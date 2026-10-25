// Profile and target shapes shared by the server and the interface.
import * as v from 'valibot';
import { isIsoDate } from './diary-rules.ts';

export interface Profile {
	heightCm: number | null;
	birthDate: string | null;
	sex: 'female' | 'male' | null;
	bodyFatPct: number | null;
	waistCm: number | null;
	pregnant: boolean;
	breastfeeding: boolean;
	decimalMark: ',' | '.';
	firstDayOfWeek: number;
}

export interface TargetVersion {
	id: string;
	effectiveFrom: string;
	mode: 'calculated' | 'manual' | 'none';
	/** Calculated: base burn; manual: the daily budget itself; none: null. */
	baseBurnKcal: number | null;
	deficitKcal: number;
	floorKcal: number;
	goalWeightKg: number | null;
	rateKgPerWeek: number | null;
	proteinGPerKg: number | null;
	proteinBasisKg: number | null;
	fatShare: number | null;
	inputs: Record<string, unknown>;
	createdAt: string;
}

const optionalNumber = (min: number, max: number) =>
	v.optional(v.nullable(v.pipe(v.number(), v.finite(), v.minValue(min), v.maxValue(max))), null);

export const ProfileInput = v.object({
	heightCm: optionalNumber(50, 260),
	birthDate: v.optional(v.nullable(v.pipe(v.string(), v.check(isIsoDate, 'Invalid date'))), null),
	sex: v.optional(v.nullable(v.picklist(['female', 'male'])), null),
	bodyFatPct: optionalNumber(2, 75),
	waistCm: optionalNumber(30, 250),
	pregnant: v.optional(v.boolean(), false),
	breastfeeding: v.optional(v.boolean(), false),
	decimalMark: v.optional(v.picklist([',', '.']), ','),
	firstDayOfWeek: v.optional(v.pipe(v.number(), v.integer(), v.minValue(1), v.maxValue(7)), 1)
});
export type ProfileInput = v.InferOutput<typeof ProfileInput>;

const Day = v.pipe(v.string(), v.check(isIsoDate, 'Invalid date'));

export const TargetInput = v.variant('mode', [
	v.object({
		mode: v.literal('calculated'),
		effectiveFrom: Day,
		rateKgPerWeek: v.pipe(v.number(), v.minValue(0), v.maxValue(1)),
		goalWeightKg: optionalNumber(20, 700),
		fixedBaseBurnKcal: optionalNumber(800, 6000),
		floorKcal: optionalNumber(800, 4000),
		proteinGPerKg: optionalNumber(0.5, 2.5),
		fatShare: optionalNumber(0.15, 0.5)
	}),
	v.object({
		mode: v.literal('manual'),
		effectiveFrom: Day,
		budgetKcal: v.pipe(v.number(), v.finite(), v.minValue(500), v.maxValue(10_000))
	}),
	v.object({ mode: v.literal('none'), effectiveFrom: Day })
]);
export type TargetInput = v.InferOutput<typeof TargetInput>;
