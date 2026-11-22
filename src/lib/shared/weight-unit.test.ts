import { describe, expect, it } from 'vitest';
import { fromKg, typedKg, weightFixed, weightText } from './weight-unit.ts';

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
