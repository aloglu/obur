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
