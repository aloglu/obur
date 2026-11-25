import { describe, expect, it } from 'vitest';
import { fromKg, typedKg, weightChangeText, weightFixed, weightText } from './weight-unit.ts';

describe('weight unit', () => {
	it('shows stored kilograms in either unit', () => {
		expect(weightText(84.65, 'kg')).toBe('84.65 kg');
		expect(weightText(84, 'lb')).toBe('185.2 lb');
		expect(weightFixed(84, 'kg')).toBe('84.0');
		expect(fromKg(0.45359237, 'lb')).toBeCloseTo(1, 12);
	});

	it('stores typed pounds so they show again as typed', () => {
		for (const lb of [100, 150.5, 185.2, 220, 299.9, 400.1]) {
			const kg = typedKg(lb, 'lb');
			expect(Math.round(kg * 100)).toBe(kg * 100); // two decimals, as the database keeps
			expect(weightText(kg, 'lb')).toBe(`${lb} lb`);
		}
		expect(typedKg(84.65, 'kg')).toBe(84.65);
	});
});

describe('a weight change in the person’s unit (2026-11-25 Review.md audit, 1.5)', () => {
	it('rounds in the unit shown, and its sign follows what is shown', () => {
		const lb = 0.45359237;
		expect(weightChangeText(-1 * lb, 'lb')).toBe('−1.0');
		expect(weightChangeText(-0.5 * lb, 'lb')).toBe('−0.5');
		expect(weightChangeText(-0.1 * lb, 'lb')).toBe('−0.1');
		expect(weightChangeText(0.02, 'kg')).toBe('±0.0');
		expect(weightChangeText(0.2, 'kg')).toBe('+0.2');
	});
});
