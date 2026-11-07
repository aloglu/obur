// Profile and target shapes shared by the server and the interface.
import type { AppIconId } from './app-icons.ts';
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
	/** The chosen Home Screen icon; null is the default. */
	appIcon: AppIconId | null;
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
	/** Counted activity adds to the budget. */
	countActivity: boolean;
	/** At the goal weight: keep the deficit, or switch to maintenance (calculated targets). */
	atGoal: 'keep' | 'maintain';
	/** balanced: protein from body weight, fatShare of the budget, carbohydrate the rest; percent: own shares. */
	macroMode: 'balanced' | 'percent';
	proteinShare: number | null;
	carbShare: number | null;
	createdAt: string;
}

/** Macro targets: the balanced default, or whole-percent shares of the day's budget that add up to 100. */
export type MacroChoice =
	{ mode: 'balanced' } | { mode: 'percent'; proteinPct: number; carbPct: number; fatPct: number };

const Pct = v.pipe(v.number(), v.integer(), v.minValue(0), v.maxValue(100));
export const MacroChoiceInput = v.variant('mode', [
	v.object({ mode: v.literal('balanced') }),
	v.pipe(
		v.object({ mode: v.literal('percent'), proteinPct: Pct, carbPct: Pct, fatPct: Pct }),
		v.check((c) => c.proteinPct + c.carbPct + c.fatPct === 100, 'The shares must add up to 100 %')
	)
]);

export const BudgetSettingsInput = v.object({
	countActivity: v.optional(v.boolean()),
	atGoal: v.optional(v.picklist(['keep', 'maintain'])),
	macros: v.optional(MacroChoiceInput),
	/** A calculated budget's pace and goal weight (the Goal page). */
	rateKgPerWeek: v.optional(v.pipe(v.number(), v.minValue(0), v.maxValue(1))),
	goalWeightKg: v.optional(v.nullable(v.pipe(v.number(), v.minValue(20), v.maxValue(700))))
});
export type BudgetSettingsChange = Partial<BudgetSettings> & {
	rateKgPerWeek?: number;
	goalWeightKg?: number | null;
};
export type BudgetSettings = {
	countActivity: boolean;
	atGoal: 'keep' | 'maintain';
	macros: MacroChoice;
};

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

/**
 * The details Profile edits (docs/design.md, "Targets, profile and activity"). `goalWeightKg` applies to a calculated
 * budget only: absent leaves it as it is, null clears it.
 */
export const ProfileDetailsInput = v.object({
	heightCm: v.pipe(v.number(), v.finite(), v.minValue(50), v.maxValue(260)),
	birthDate: Day,
	sex: v.picklist(['female', 'male']),
	goalWeightKg: v.optional(
		v.nullable(v.pipe(v.number(), v.finite(), v.minValue(20), v.maxValue(700)))
	),
	// The rest of setup's "About you"; left out, each stays as it was.
	bodyFatPct: v.optional(v.nullable(v.pipe(v.number(), v.finite(), v.minValue(2), v.maxValue(75)))),
	waistCm: v.optional(v.nullable(v.pipe(v.number(), v.finite(), v.minValue(30), v.maxValue(250)))),
	pregnant: v.optional(v.boolean()),
	breastfeeding: v.optional(v.boolean())
});
export type ProfileDetailsInput = v.InferOutput<typeof ProfileDetailsInput>;

/** What saving the details did to a calculated budget. */
export type DetailsOutcome =
	| { kind: 'unchanged' }
	| { kind: 'recalculated'; beforeKcal: number; afterKcal: number }
	/** The budget in force stays as it was: a calculation is no longer allowed (a minor, say) or possible. */
	| {
			kind: 'not_recalculated';
			reason: 'targets_not_allowed' | 'profile_incomplete' | 'weight_required';
	  };
