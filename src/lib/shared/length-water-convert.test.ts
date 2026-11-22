import { describe, expect, it } from 'vitest';
import { cmToFeetInches, cmToInches, feetInchesToCm, inchesToCm } from './length-convert.ts';
import { fromMl, toMl } from './water-convert.ts';

describe('feet and inches', () => {
	it('stores a typed height in centimetres and shows it again as typed', () => {
		for (const [feet, inches] of [
			[5, 10],
			[6, 0],
			[4, 11.5],
			[5, 3]
		]) {
			expect(cmToFeetInches(feetInchesToCm(feet, inches))).toEqual({ feet, inches });
		}
		expect(feetInchesToCm(5, 10)).toBe(177.8);
	});
	it('never shows 12 inches', () => {
		expect(cmToFeetInches(182.8)).toEqual({ feet: 6, inches: 0 });
		expect(cmToFeetInches(180)).toEqual({ feet: 5, inches: 10.9 });
	});
	it('waist in inches', () => {
		expect(inchesToCm(34)).toBe(86.4);
		expect(cmToInches(86.4)).toBe(34);
	});
});

describe('fluid ounces', () => {
	it('stores ounces in millilitres and shows them again as typed', () => {
		expect(toMl(8, 'floz')).toBe(236.6);
		expect(fromMl(toMl(8, 'floz'), 'floz')).toBeCloseTo(8, 2);
		expect(fromMl(toMl(16.9, 'floz'), 'floz')).toBeCloseTo(16.9, 2);
		expect(toMl(250, 'ml')).toBe(250);
	});
});
