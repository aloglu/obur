// Fixture tests for the target formulas, using worked examples from the published equations.
import { describe, expect, it } from 'vitest';
import {
	ageOn,
	baseBurn,
	bmi,
	budgetForDay,
	bmrKatchMcArdle,
	bmrMifflinStJeor,
	dailyBudget,
	dailyDeficit,
	macroTargets,
	maxRate,
	targetsAllowed,
	whoAdultCategory
} from './goals.ts';

describe('formulas', () => {
	// Mifflin et al., Am J Clin Nutr 1990;51:241–7.
	it('Mifflin–St Jeor: 80 kg, 180 cm, 30-year-old man = 1,780 kcal/day', () => {
		expect(bmrMifflinStJeor('male', 80, 180, 30)).toBe(1780);
	});

	it('Mifflin–St Jeor: 60 kg, 165 cm, 25-year-old woman = 1,345.25 kcal/day', () => {
		expect(bmrMifflinStJeor('female', 60, 165, 25)).toBe(1345.25);
	});

	it('Katch–McArdle: 80 kg at 20 % body fat (64 kg lean) = 1,752.4 kcal/day', () => {
		expect(bmrKatchMcArdle(80, 20)).toBeCloseTo(1752.4, 6);
	});

	it('BMI: 82.4 kg at 1.80 m = 25.4 and WHO adult categories at their boundaries', () => {
		expect(bmi(82.4, 180)).toBeCloseTo(25.43, 2);
		expect(whoAdultCategory(18.49)).toBe('underweight');
		expect(whoAdultCategory(18.5)).toBe('normal');
		expect(whoAdultCategory(24.99)).toBe('normal');
		expect(whoAdultCategory(25)).toBe('overweight');
		expect(whoAdultCategory(30)).toBe('obesity_1');
		expect(whoAdultCategory(35)).toBe('obesity_2');
		expect(whoAdultCategory(40)).toBe('obesity_3');
	});
});

describe('ageOn', () => {
	it('counts birthdays from the day itself, including 29 February', () => {
		expect(ageOn('1990-10-25', '2026-10-24')).toBe(35);
		expect(ageOn('1990-10-25', '2026-10-25')).toBe(36);
		expect(ageOn('2008-02-29', '2026-02-28')).toBe(17);
		expect(ageOn('2008-02-29', '2026-03-01')).toBe(18);
	});
});

describe('base burn', () => {
	const man = { sex: 'male' as const, birthDate: '1996-01-01', heightCm: 180, weightKg: 80 };

	it('is BMR × 1.2 with Mifflin–St Jeor by default', () => {
		expect(baseBurn(man, '2026-06-01')).toEqual({
			kcal: 2136,
			formula: 'mifflin_st_jeor',
			bmr: 1780
		});
	});

	it('uses Katch–McArdle when body fat is known', () => {
		const r = baseBurn({ ...man, bodyFatPct: 20 }, '2026-06-01');
		expect(r).toMatchObject({ formula: 'katch_mcardle', kcal: 2103 });
	});
});

describe('deficit and budget', () => {
	it('uses 7,700 kcal per kg and caps the rate at 1 kg or 1 % of body weight per week', () => {
		expect(dailyDeficit(0.5, 80)).toBe(550);
		expect(dailyDeficit(1, 120)).toBe(1100);
		expect(maxRate(60)).toBe(0.6);
		expect(dailyDeficit(1, 60)).toBe(660); // capped at 0.6 kg/week
		expect(dailyDeficit(0, 80)).toBe(0);
	});

	it('adds activity, subtracts the deficit and never drops below the floor', () => {
		// The design's example: base 2,000 + 1,000 burned, no deficit = 3,000.
		expect(dailyBudget({ baseBurn: 2000, deficit: 0, floor: 1200 }, 1000)).toBe(3000);
		expect(dailyBudget({ baseBurn: 2136, deficit: 550, floor: 1500 }, 0)).toBe(1586);
		expect(dailyBudget({ baseBurn: 1700, deficit: 660, floor: 1200 }, 0)).toBe(1200);
	});
});

describe('who may get calculated targets', () => {
	it('excludes minors, pregnancy and breastfeeding', () => {
		expect(targetsAllowed({ birthDate: '2000-01-01' }, '2026-10-25')).toBe(true);
		expect(targetsAllowed({ birthDate: '2009-10-26' }, '2026-10-25')).toBe(false);
		expect(targetsAllowed({ birthDate: '2000-01-01', pregnant: true }, '2026-10-25')).toBe(false);
		expect(targetsAllowed({ birthDate: '2000-01-01', breastfeeding: true }, '2026-10-25')).toBe(
			false
		);
	});
});

describe('macro targets', () => {
	it('derives protein from body weight, fat from calories, carbohydrate from the rest', () => {
		expect(macroTargets(2000, { proteinGPerKg: 1.2, proteinBasisKg: 75, fatShare: 0.3 })).toEqual({
			proteinG: 90,
			fatG: 67,
			carbohydrateG: 259
		});
	});

	it('never returns negative carbohydrate', () => {
		expect(
			macroTargets(1000, { proteinGPerKg: 2.5, proteinBasisKg: 120, fatShare: 0.4 }).carbohydrateG
		).toBe(0);
	});
});

describe('budgetForDay', () => {
	it('combines the target with counted activity and reports when the floor applied', () => {
		const target = {
			mode: 'calculated' as const,
			baseBurnKcal: 2136,
			deficitKcal: 550,
			floorKcal: 1500
		};
		expect(budgetForDay(target, 300)).toEqual({
			budget: 1886,
			baseKcal: 2136,
			activityKcal: 300,
			activityNotAddedKcal: 0,
			deficitKcal: 550,
			floorApplied: false
		});
		expect(budgetForDay({ ...target, baseBurnKcal: 1700, deficitKcal: 660 }, 0)?.floorApplied).toBe(
			true
		);
		expect(
			budgetForDay({ mode: 'manual', baseBurnKcal: 2300, deficitKcal: 0, floorKcal: 0 }, 200)
				?.budget
		).toBe(2500);
		expect(
			budgetForDay({ mode: 'none', baseBurnKcal: null, deficitKcal: 0, floorKcal: 0 }, 200)
		).toBeNull();
		expect(budgetForDay(null, 0)).toBeNull();
	});

	it('leaves activity out when the setting says so, and reports how much', () => {
		const target = {
			mode: 'calculated' as const,
			baseBurnKcal: 2136,
			deficitKcal: 550,
			floorKcal: 1500,
			countActivity: false
		};
		expect(budgetForDay(target, 300)).toMatchObject({
			budget: 1586,
			activityKcal: 0,
			activityNotAddedKcal: 300
		});
	});
});
