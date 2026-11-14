import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { foodName, hasTurkish, portionName, servingLabelName } from './curated-names.ts';
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
	});

	it('show any food’s everyday portion word in Turkish, display only (owner, 2026-11-14)', () => {
		const tr = <T>(fn: () => T) => overwriteLocale('tr', fn);
		expect(tr(() => portionName('Slice', false))).toBe('Dilim');
		expect(tr(() => portionName('slice', false))).toBe('dilim');
		expect(tr(() => portionName('Scoop', false))).toBe('Ölçek');
		expect(portionName('Slice', false)).toBe('Slice');
		// Only a portion word alone: a word that reads the same, or a longer name, stays as typed.
		expect(tr(() => portionName('Bar', false))).toBe('Bar');
		expect(tr(() => portionName('Slice of grandma’s cake', false))).toBe('Slice of grandma’s cake');
		expect(tr(() => servingLabelName('1 slice'))).toBe('1 dilim');
		expect(tr(() => servingLabelName('2 Cups'))).toBe('2 Bardak');
		expect(tr(() => servingLabelName('1 bar (50 g)'))).toBe('1 bar (50 g)');
		expect(servingLabelName('1 slice')).toBe('1 slice');
	});
});
