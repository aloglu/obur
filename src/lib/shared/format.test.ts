import { describe, expect, it } from 'vitest';
import { dayTitle, longDate, quantityText } from './format.ts';

describe('format', () => {
	it('titles days the same way in every engine', () => {
		expect(dayTitle('2026-10-25', '2026-10-25')).toBe('Today');
		expect(dayTitle('2026-10-24', '2026-10-25')).toBe('Yesterday');
		expect(dayTitle('2026-10-20', '2026-10-25')).toBe('Tue 20 Oct');
		expect(dayTitle('2025-12-31', '2026-01-02')).toBe('Wed 31 Dec');
		expect(longDate('2026-10-20')).toBe('Tuesday 20 October 2026');
		expect(longDate('2028-02-29')).toBe('Tuesday 29 February 2028');
	});

	it('describes quantities with decimal commas and readable portions', () => {
		expect(quantityText(225, { kind: 'mass', unit: 'g' }, null)).toBe('225 g');
		expect(quantityText(1.5, { kind: 'volume', unit: 'us_cup' }, null)).toBe('1,5 US cup');
		expect(quantityText(1, { kind: 'basis_serving' }, '1 bar')).toBe('1 bar');
		expect(quantityText(2, { kind: 'basis_serving' }, '1 bar')).toBe('2 × 1 bar');
		expect(
			quantityText(
				3,
				{ kind: 'serving', servingId: 'a', name: 'slice', amount: 26, unit: 'g' },
				null
			)
		).toBe('3 × slice (26 g)');
		expect(
			quantityText(2, { kind: 'measure', code: 'su_bardagi', name: 'Su bardağı', ml: 200 }, null)
		).toBe('2 × Su bardağı (200 ml)');
	});
});
