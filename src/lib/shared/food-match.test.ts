import { describe, expect, it } from 'vitest';
import { caloriesAgree, matchKey, sameFood, type MatchableFood } from './food-match.ts';

const food = (over: Partial<MatchableFood> = {}): MatchableFood => ({
	name: 'Greek Yogurt',
	brand: 'Sütaş',
	basis: '100g',
	servingSize: null,
	kcal: 97,
	...over
});

describe('matchKey', () => {
	it.each([
		['yogurt, greek', 'SUTAS'],
		['GREEK yogurt', 'sütaş'],
		['Greek  Yogurt', 'Sutaş']
	])('treats %s / %s as Greek Yogurt / Sütaş', (name, brand) => {
		expect(matchKey(name, brand)).toBe(matchKey('Greek Yogurt', 'Sütaş'));
	});

	it('folds Turkish letters and keeps the brand part of the name', () => {
		expect(matchKey('Işık ekmeği', null)).toBe(matchKey('isik ekmegi', null));
		expect(matchKey('Greek Yogurt', null)).not.toBe(matchKey('Greek Yogurt', 'Sütaş'));
		expect(matchKey('Greek Yogurt', 'Sütaş')).not.toBe(matchKey('Greek Yogurt Light', 'Sütaş'));
	});
});

describe('caloriesAgree', () => {
	it('compares per 100 g, within 10 % or 10 kcal', () => {
		expect(caloriesAgree(food(), food({ kcal: 105 }))).toBe(true);
		expect(caloriesAgree(food(), food({ kcal: 110 }))).toBe(false);
		expect(caloriesAgree(food({ kcal: 400 }), food({ kcal: 440 }))).toBe(true);
		expect(caloriesAgree(food({ kcal: 400 }), food({ kcal: 450 }))).toBe(false);
	});

	it('converts a serving of known size, and never compares grams with millilitres', () => {
		const bar = food({ basis: 'serving', servingSize: { amount: 40, unit: 'g' }, kcal: 38.8 });
		expect(caloriesAgree(bar, food())).toBe(true);
		expect(caloriesAgree(food({ basis: '100ml' }), food())).toBeNull();
	});

	it('compares servings without a size only when they are described the same way', () => {
		const slice = (label: string, kcal: number) =>
			food({ basis: 'serving', servingSize: null, servingLabel: label, kcal });
		expect(caloriesAgree(slice('1 slice', 80), slice('1 Slice', 85))).toBe(true);
		expect(caloriesAgree(slice('1 slice', 80), slice('1 piece', 85))).toBeNull();
		expect(caloriesAgree(slice('1 slice', 80), food())).toBeNull();
	});

	it('does not compare unknown calories (unknown is not zero)', () => {
		expect(caloriesAgree(food({ kcal: null }), food())).toBeNull();
	});
});

describe('sameFood', () => {
	it('needs the same name and brand, and calories that do not disagree', () => {
		expect(sameFood(food(), food({ name: 'yogurt greek', kcal: 100 }))).toBe(true);
		expect(sameFood(food(), food({ kcal: 150 }))).toBe(false);
		expect(sameFood(food(), food({ brand: 'Pınar' }))).toBe(false);
		// Calories that can't be compared don't rule it out: the person decides.
		expect(sameFood(food(), food({ kcal: null }))).toBe(true);
	});
});
