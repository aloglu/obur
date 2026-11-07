// Target calculations (docs/design.md, "Targets, profile and activity"). Estimates and guardrails, not medical
// advice. Pure functions with fixture tests; stored targets keep their computed numbers, so changing a formula
// never rewrites past days.

export const CALCULATION_VERSION = '2026-10-v1';

export type Sex = 'female' | 'male';
export type Formula = 'mifflin_st_jeor' | 'katch_mcardle';

export const SEDENTARY_FACTOR = 1.2;
export const KCAL_PER_KG = 7700;
export const MAX_RATE_KG_PER_WEEK = 1;
/** Weekly loss is capped at this fraction of body weight. */
export const MAX_WEEKLY_FRACTION = 0.01;
export const DEFAULT_FLOOR: Record<Sex, number> = { male: 1500, female: 1200 };
/** Editable defaults: protein per kg of goal weight (or current weight without a goal); fat share of calories. */
export const DEFAULT_PROTEIN_G_PER_KG = 1.2;
export const DEFAULT_FAT_SHARE = 0.3;
export const ADULT_AGE = 18;

/** Whole years on a date (birthdays count from the day itself). */
export function ageOn(birthDate: string, onDate: string): number {
	const [by, bm, bd] = birthDate.split('-').map(Number);
	const [y, m, d] = onDate.split('-').map(Number);
	return y - by - (m < bm || (m === bm && d < bd) ? 1 : 0);
}

/** Mifflin MD, St Jeor ST et al. (1990): 10·kg + 6.25·cm − 5·age + 5 (men) or − 161 (women). */
export function bmrMifflinStJeor(sex: Sex, kg: number, cm: number, age: number): number {
	return 10 * kg + 6.25 * cm - 5 * age + (sex === 'male' ? 5 : -161);
}

/** Katch–McArdle: 370 + 21.6 × lean body mass (kg). */
export function bmrKatchMcArdle(kg: number, bodyFatPct: number): number {
	return 370 + 21.6 * kg * (1 - bodyFatPct / 100);
}

export function bmi(kg: number, cm: number): number {
	const m = cm / 100;
	return kg / (m * m);
}

export type BmiCategory =
	'underweight' | 'normal' | 'overweight' | 'obesity_1' | 'obesity_2' | 'obesity_3';

/** WHO adult categories. Not for minors or pregnancy, and not a diagnosis. */
export function whoAdultCategory(value: number): BmiCategory {
	if (value < 18.5) return 'underweight';
	if (value < 25) return 'normal';
	if (value < 30) return 'overweight';
	if (value < 35) return 'obesity_1';
	if (value < 40) return 'obesity_2';
	return 'obesity_3';
}

export interface ProfileFacts {
	sex: Sex;
	birthDate: string;
	heightCm: number;
	weightKg: number;
	bodyFatPct?: number | null;
	pregnant?: boolean;
	breastfeeding?: boolean;
}

/**
 * Whether algorithmic targets may be offered. Minors, pregnancy and breastfeeding get logging without calculated
 * calorie or weight-loss targets; a professional's target can still be entered by hand.
 */
export function targetsAllowed(
	p: Pick<ProfileFacts, 'birthDate' | 'pregnant' | 'breastfeeding'>,
	onDate: string
): boolean {
	return ageOn(p.birthDate, onDate) >= ADULT_AGE && !p.pregnant && !p.breastfeeding;
}

/**
 * Whether a goal weight may sit next to a budget set by hand: not for someone the profile says is under 18, pregnant
 * or breastfeeding, whose weight achievements would celebrate weight loss. Unknown facts don't block it.
 */
export function goalWeightAllowed(
	p: { birthDate: string | null; pregnant: boolean; breastfeeding: boolean } | null | undefined,
	onDate: string
): boolean {
	if (!p) return true;
	if (p.pregnant || p.breastfeeding) return false;
	return !p.birthDate || ageOn(p.birthDate, onDate) >= ADULT_AGE;
}

export function baseBurn(
	p: ProfileFacts,
	onDate: string
): { kcal: number; formula: Formula; bmr: number } {
	const age = ageOn(p.birthDate, onDate);
	const useKatch = p.bodyFatPct !== null && p.bodyFatPct !== undefined;
	const bmr = useKatch
		? bmrKatchMcArdle(p.weightKg, p.bodyFatPct!)
		: bmrMifflinStJeor(p.sex, p.weightKg, p.heightCm, age);
	return {
		kcal: Math.round(bmr * SEDENTARY_FACTOR),
		formula: useKatch ? 'katch_mcardle' : 'mifflin_st_jeor',
		bmr
	};
}

/** The fastest weekly loss offered for a body weight: 1 kg, or 1 % of body weight if that is less. */
export function maxRate(weightKg: number): number {
	return Math.min(MAX_RATE_KG_PER_WEEK, Math.floor(weightKg * MAX_WEEKLY_FRACTION * 100) / 100);
}

/** Daily deficit for a weekly rate (kg/week), after the cap. */
export function dailyDeficit(rateKgPerWeek: number, weightKg: number): number {
	const rate = Math.max(0, Math.min(rateKgPerWeek, maxRate(weightKg)));
	return Math.round((rate * KCAL_PER_KG) / 7);
}

/** Daily budget = base burn + counted activity − deficit, never below the floor. */
export function dailyBudget(
	t: { baseBurn: number; deficit: number; floor: number },
	activityKcal: number
): number {
	return Math.max(t.floor, Math.round(t.baseBurn + activityKcal - t.deficit));
}

export interface MacroTargets {
	proteinG: number;
	fatG: number;
	carbohydrateG: number;
}

/**
 * The day's macro targets for the target in force: the person's own percentages of the budget, or the balanced
 * default (calculated targets only, since it needs body weight). Null when the target sets none.
 */
export function macroTargetsFor(
	budgetKcal: number,
	t: {
		mode: 'calculated' | 'manual' | 'none';
		macroMode: 'balanced' | 'percent';
		proteinShare: number | null;
		carbShare: number | null;
		fatShare: number | null;
		proteinGPerKg: number | null;
		proteinBasisKg: number | null;
	}
): MacroTargets | null {
	if (t.macroMode === 'percent') {
		if (t.proteinShare === null || t.carbShare === null || t.fatShare === null) return null;
		return {
			proteinG: Math.round((budgetKcal * t.proteinShare) / 4),
			fatG: Math.round((budgetKcal * t.fatShare) / 9),
			carbohydrateG: Math.round((budgetKcal * t.carbShare) / 4)
		};
	}
	if (t.mode !== 'calculated' || !t.proteinGPerKg || !t.proteinBasisKg || !t.fatShare) return null;
	return macroTargets(budgetKcal, {
		proteinGPerKg: t.proteinGPerKg,
		proteinBasisKg: t.proteinBasisKg,
		fatShare: t.fatShare
	});
}

/** Protein from body weight; fat as a share of calories; carbohydrate the rest (never negative). */
export function macroTargets(
	budgetKcal: number,
	t: { proteinGPerKg: number; proteinBasisKg: number; fatShare: number }
): MacroTargets {
	const proteinG = Math.round(t.proteinGPerKg * t.proteinBasisKg);
	const fatG = Math.round((budgetKcal * t.fatShare) / 9);
	const carbohydrateG = Math.max(0, Math.round((budgetKcal - proteinG * 4 - fatG * 9) / 4));
	return { proteinG, fatG, carbohydrateG };
}

export interface DayBudget {
	budget: number;
	baseKcal: number;
	activityKcal: number;
	/** Counted activity left out because the budget setting does not add activity. */
	activityNotAddedKcal: number;
	deficitKcal: number;
	floorApplied: boolean;
}

/**
 * The budget for a day from the target in force and that day's counted activity. A manual target is the budget
 * for an inactive day, so counted activity is added to it too. No target (or mode "none") means no budget.
 */
export function budgetForDay(
	target: {
		mode: 'calculated' | 'manual' | 'none';
		baseBurnKcal: number | null;
		deficitKcal: number;
		floorKcal: number;
		/** Absent (older data) means activity is added. */
		countActivity?: boolean;
	} | null,
	counted: number
): DayBudget | null {
	if (!target || target.mode === 'none' || target.baseBurnKcal === null) return null;
	const adds = target.countActivity !== false;
	const activityKcal = adds ? counted : 0;
	const raw = Math.round(target.baseBurnKcal + activityKcal - target.deficitKcal);
	const budget = Math.max(target.floorKcal, raw);
	return {
		budget,
		baseKcal: target.baseBurnKcal,
		activityKcal,
		activityNotAddedKcal: adds ? 0 : counted,
		deficitKcal: target.deficitKcal,
		floorApplied: budget > raw
	};
}

export type BudgetStatus = 'plenty' | 'close' | 'over';

/** The budget bar's colour (docs/ui.md): with room, in the last 200 kcal or 10 %, or over. */
export function budgetStatus(eaten: number, budget: number): BudgetStatus {
	const left = budget - eaten;
	if (left < 0) return 'over';
	return left < 200 || left < budget * 0.1 ? 'close' : 'plenty';
}
