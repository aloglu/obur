import { describe, expect, it } from 'vitest';
import { metricPortionName } from './metric-portion.ts';

// Real SR Legacy portion names and what people see instead.
const cases: [string, string | null][] = [
	['medium (7" to 7-7/8" long)', 'medium (18–20 cm long)'],
	['extra small (less than 6" long)', 'extra small (less than 15 cm long)'],
	['small (1-3/4" to 2-1/2" dia.)', 'small (4–6 cm across)'],
	['head large (6-7" dia.)', 'head large (15–18 cm across)'],
	['medium whole (2-3/5" dia)', 'medium whole (7 cm across)'],
	['slice, medium (1/4" thick)', 'slice, medium (0,6 cm thick)'],
	['large (7-1/4" to 8-/1/2" long)', 'large (18–22 cm long)'],
	['medium (approx 2-3/4" long, 2-1/2 dia.)', 'medium (approx 7 cm long, 6 cm across)'],
	['piece (2" x 2" x 1/2")', 'piece (5 cm × 5 cm × 1,3 cm)'],
	['pat (1" sq, 1/3" high)', 'pat (2,5 cm square, 0,8 cm high)'],
	['cubic inch', '2,5 cm cube'],
	[
		'large (2-1/4 per lb, approx 3-3/4" long, 3" dia)',
		'large (about 5 per kg, approx 10 cm long, 8 cm across)'
	],
	['eggplant, unpeeled (approx 1-1/4 lb)', 'eggplant, unpeeled (approx 567 g)'],
	['unit (yield from 1 lb ready-to-cook chicken)', 'unit (yield from 454 g ready-to-cook chicken)'],
	['can (12.5 oz), drained', 'can (354 g), drained'],
	['wedge (1.33 oz)', 'wedge (38 g)'],
	['slice (1 oz)', 'slice (28 g)'],
	['oz (14 halves)', '14 halves'],
	['oz (10-12 kernels)', '10-12 kernels'],
	['can 12 fl oz', 'can (355 ml)'],
	['serving medium 21 fl oz', 'serving medium (621 ml)'],
	['cup (8 fl oz)', 'US cup (237 ml)'],
	['cup', 'US cup (237 ml)'],
	['cup, chopped', 'US cup (237 ml), chopped'],
	['cup chopped (1/2" pieces)', 'US cup (237 ml), chopped (1,3 cm pieces)'],
	['pint as purchased, yields', 'US pint (473 ml) as purchased, yields'],
	['cup (4.86 large eggs)', 'US cup (237 ml), 4,86 large eggs'],
	['cup (not packed)', 'US cup (237 ml), not packed'],
	['medium (2-1/4" to 2-1/4" dia.)', 'medium (6 cm across)'],
	['tbsp', 'tablespoon'],
	['tbsp chopped', 'tablespoon, chopped'],
	['tsp', 'teaspoon'],
	['medium', 'medium'],
	['oz', null],
	['lb', null],
	['fl oz', null],
	['quart', null]
];

describe('metricPortionName', () => {
	it.each(cases)('%s → %s', (input, expected) => {
		expect(metricPortionName(input)).toBe(expected);
	});

	it('stays within 60 characters, shortening the cup first', () => {
		const name = metricPortionName('cup, in shell, edible yield (7 nuts), with extra words here');
		expect(name!.length).toBeLessThanOrEqual(60);
		expect(name!.startsWith('US cup,')).toBe(true);
	});
});
