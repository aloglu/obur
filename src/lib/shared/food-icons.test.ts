import { readdirSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { FOOD_ICONS, suggestIcon } from './food-icons.ts';

const hexOf = (word: string) => FOOD_ICONS.find((i) => i.words.includes(word))!.hex;

describe('food icons', () => {
	it('has a file for every icon and an icon for every file', () => {
		const files = readdirSync('static/icons/food')
			.filter((f) => f.endsWith('.svg'))
			.map((f) => f.replace('.svg', ''))
			.sort();
		expect([...new Set(FOOD_ICONS.map((i) => i.hex))].sort()).toEqual(files);
		// Each has a dark-theme variant with no black left (node scripts/food-icons-dark.ts).
		const dark = readdirSync('static/icons/food/dark').filter((f) => f.endsWith('.svg'));
		expect(dark.map((f) => f.replace('.svg', '')).sort()).toEqual(files);
		for (const f of dark)
			expect(readFileSync(`static/icons/food/dark/${f}`, 'utf8')).not.toMatch(/"#000/);
	});

	it('suggests from the word that names the thing, in Turkish and English', () => {
		expect(suggestIcon('Mercimek çorbası')).toBe(hexOf('soup'));
		expect(suggestIcon('Tavuk göğsü')).toBe(hexOf('chicken'));
		expect(suggestIcon('Tam Buğday Ekmeği')).toBe(hexOf('bread'));
		expect(suggestIcon('Light Beyaz Peynir')).toBe(hexOf('cheese'));
		expect(suggestIcon('Sütlü kahve')).toBe(hexOf('coffee'));
		expect(suggestIcon('Çilekli yoğurt')).toBe(hexOf('yogurt'));
		expect(suggestIcon('Chicken noodle soup')).toBe(hexOf('soup'));
		expect(suggestIcon('Chocolate Protein Bar')).toBe(hexOf('protein bar'));
		expect(suggestIcon('Simit')).toBe(hexOf('simit'));
		expect(suggestIcon('Ton balığı')).toBe(hexOf('ton balığı'));
	});

	it('keeps short words whole: no tea in "teas", no water in "sucuk", no honey in "balık"', () => {
		expect(suggestIcon('Sucuk')).toBe(hexOf('sucuk'));
		expect(suggestIcon('Hamsi')).toBe(hexOf('hamsi'));
		expect(suggestIcon('Balık')).toBe(hexOf('balık'));
		expect(suggestIcon('Ballı lokum')).toBe(hexOf('lokum'));
		expect(suggestIcon('Tuzlu fıstık')).toBe(hexOf('fıstık'));
		expect(suggestIcon('Su')).toBe(hexOf('su'));
		expect(suggestIcon('Edirne')).toBeNull();
		expect(suggestIcon('Tavuğu bol pilav')).toBe(hexOf('pilav'));
		expect(suggestIcon('Dana bifteği')).toBe(hexOf('biftek'));
	});

	it('suggests nothing for a name that says nothing, and uses later texts only then', () => {
		expect(suggestIcon('Hafta içi kahvaltı')).toBeNull();
		expect(suggestIcon('Pasta')).toBeNull();
		expect(suggestIcon('Premium Light', 'Ekmek')).toBe(hexOf('ekmek'));
		expect(suggestIcon('Peynir', 'Ekmek')).toBe(hexOf('peynir'));
	});
});
