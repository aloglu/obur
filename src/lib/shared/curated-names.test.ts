import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { foodName, hasTurkish, portionName } from './curated-names.ts';
import { overwriteLocale } from './test-locale.ts';

const file = JSON.parse(
	readFileSync('src/lib/server/modules/catalog/curated/usda-foods.json', 'utf8')
) as { foods: { name: string; portions: { name: string }[] }[] };

describe('built-in food names in Turkish', () => {
	it('cover every built-in food and portion', () => {
		expect(file.foods.map((f) => f.name).filter((n) => !hasTurkish(n, 'name'))).toEqual([]);
		const portions = file.foods.flatMap((f) => f.portions.map((p) => p.name));
		expect(portions.filter((n) => !hasTurkish(n, 'portion'))).toEqual([]);
	});

	it('show only for built-in foods, and only in Turkish', () => {
		const tr = <T>(fn: () => T) => overwriteLocale('tr', fn);
		expect(tr(() => foodName('Feta cheese', true))).toBe('Feta peyniri');
		expect(foodName('Feta cheese', true)).toBe('Feta cheese');
		// A typed food with the same name is never translated.
		expect(tr(() => foodName('Banana', false))).toBe('Banana');
		expect(tr(() => portionName('US cup (237 ml), chopped', true))).toBe(
			'ABD bardağı (237 ml), doğranmış'
		);
		// Older diary copies wrote decimal commas in portion names.
		expect(tr(() => portionName('slice, medium (0,6 cm thick)', true))).toBe(
			'dilim, orta (0,6 cm kalınlığında)'
		);
		expect(tr(() => portionName('slice', false))).toBe('slice');
	});
});
