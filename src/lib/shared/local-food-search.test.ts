import { describe, expect, it } from 'vitest';
import type { FoodDetail } from './food-types.ts';
import { searchable, searchLocal } from './local-food-search.ts';

const food = (id: string, name: string, over: Partial<FoodDetail> = {}) =>
	({
		id,
		name,
		brand: null,
		basis: '100g',
		servingLabel: null,
		servingSize: null,
		icon: null,
		origin: 'user',
		mine: true,
		servings: [],
		nutrients: [{ code: 'energy_kcal', value: 100, qualifier: 'reported' }],
		...over
	}) as unknown as FoodDetail;

const foods = searchable([
	food('1', 'Greek yogurt', { brand: 'Brand A' }),
	food('2', 'Yogurt'),
	food('3', 'Plain yogurt drink'),
	food('4', 'Yogurt, plain', { origin: 'curated', mine: false }),
	food('5', 'Şiş köfte'),
	food('6', 'Oat milk')
]);
const ids = (q: string, boost: string[] = []) => searchLocal(foods, q, 20, boost).map((r) => r.id);

describe('searchLocal', () => {
	it('matches every word, folding case, accents and Turkish letters, as the server does', () => {
		expect(ids('sis kofte')).toEqual(['5']);
		expect(ids('SIŞ')).toEqual(['5']);
		// The built-in food's name is exactly the query: real matches come before the person's own.
		expect(ids('yogurt plain')).toEqual(['4', '3']);
		expect(ids('brand a greek')).toEqual(['1']);
		expect(ids('')).toEqual([]);
	});
	it('orders own foods first, then exact, starts, word starts and anywhere, then by name', () => {
		expect(ids('yogurt')).toEqual(['2', '1', '3', '4']);
	});
	it('uses the stored search text when the copy has it (a built-in food’s aliases)', () => {
		const withAlias = searchable([{ ...food('7', 'Banana'), searchKey: 'banana plantain' }]);
		expect(searchLocal(withAlias, 'plantain').map((r) => r.id)).toEqual(['7']);
		expect(withAlias[0].food).not.toHaveProperty('searchKey');
	});
	it('puts boosted (recent) foods first among real matches', () => {
		expect(ids('yogurt', ['1'])[0]).toBe('1');
	});
	it('returns what the search list shows', () => {
		expect(searchLocal(foods, 'oat')[0]).toEqual({
			id: '6',
			name: 'Oat milk',
			brand: null,
			basis: '100g',
			servingLabel: null,
			mine: true,
			kcal: 100,
			icon: null,
			curated: false
		});
	});
	it('stays quick with thousands of foods', () => {
		const many = searchable(
			Array.from({ length: 5000 }, (_, i) => food(String(i), `Food number ${i} with yogurt`))
		);
		const started = performance.now();
		for (let i = 0; i < 20; i++) searchLocal(many, 'yogurt 42');
		expect((performance.now() - started) / 20).toBeLessThan(20);
	});
});
