import { describe, expect, it } from 'vitest';
import { readingFits } from './reading-limits.ts';

describe('readingFits', () => {
	it('judges the value as the database stores it', () => {
		expect(readingFits('weight', 699.99)).toBe(true);
		expect(readingFits('weight', 699.999)).toBe(false);
		expect(readingFits('water', 10_000)).toBe(true);
		expect(readingFits('water', 10_000.04)).toBe(true);
		expect(readingFits('water', 10_000.5)).toBe(false);
		expect(readingFits('weight', 0)).toBe(false);
	});
});
