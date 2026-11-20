import { describe, expect, it } from 'vitest';
import { changes, matchFood, typosAllowed } from './search-match.ts';
import { foldForSearch, searchKeyWithAliases } from './search-text.ts';

const match = (query: string, key: string) => matchFood(foldForSearch(query), foldForSearch(key));

describe('changes', () => {
	it('counts a wrong, missing, extra or swapped letter as one change', () => {
		expect(changes('yogurt', 'yogurt', 2)).toBe(0);
		expect(changes('yogart', 'yogurt', 2)).toBe(1);
		expect(changes('yogrt', 'yogurt', 2)).toBe(1);
		expect(changes('yoggurt', 'yogurt', 2)).toBe(1);
		expect(changes('yougrt', 'yogurt', 2)).toBe(1);
	});

	it('stops at the limit', () => {
		expect(changes('banana', 'cherry', 1)).toBe(2);
		expect(changes('a', 'abcdef', 2)).toBe(3);
	});
});

describe('typosAllowed', () => {
	it('allows none in short words, one from 5 letters, two from 9', () => {
		expect(['milk', 'süt', 'egg'].map(typosAllowed)).toEqual([0, 0, 0]);
		expect(['bread', 'yogurt', 'chickens'].map(typosAllowed)).toEqual([1, 1, 1]);
		expect(['blueberry', 'strawberries'].map(typosAllowed)).toEqual([2, 2]);
	});
});

describe('matchFood', () => {
	it('matches every word at the start of a word, in any order', () => {
		// One letter apart: a typo match, not a real one.
		expect(match('greek yogurt', 'Greek yoghurt plain')).toEqual({ typos: 1, quality: 3 });
		expect(match('plain greek', 'Greek yogurt plain')).toEqual({ typos: 0, quality: 3 });
		expect(match('gre yog', 'Greek yogurt plain')).toEqual({ typos: 0, quality: 3 });
		expect(match('greek yogurt', 'Greek yogurt plain')).toEqual({ typos: 0, quality: 1 });
	});

	it('no longer finds a word inside another word', () => {
		expect(match('rice', 'licorice')).toBeUndefined();
		expect(match('ham', 'graham crackers')).toBeUndefined();
		expect(match('rice', 'brown rice cooked')).toEqual({ typos: 0, quality: 2 });
	});

	it('finds a typo in a long name and its aliases, where the trigram rule failed', () => {
		const yogurt = searchKeyWithAliases('Greek yoghurt plain nonfat', null, {
			aliases: ['süzme yoğurt', 'yağsız yoğurt']
		});
		expect(matchFood('yougrt', yogurt)).toEqual({ typos: 1, quality: 3 });
		expect(match('chiken', 'Chicken breast meat only roasted')).toEqual({ typos: 1, quality: 3 });
		expect(match('stawberries', 'Strawberries çilek')).toEqual({ typos: 1, quality: 3 });
	});

	it('folds Turkish letters before comparing, so they cost nothing', () => {
		expect(match('yogurt', 'Yoğurt')).toEqual({ typos: 0, quality: 0 });
		expect(match('sutas', 'Sütaş ayran')).toEqual({ typos: 0, quality: 1 });
		expect(match('ISPANAK', 'ıspanak')).toEqual({ typos: 0, quality: 0 });
	});

	it('allows no typo in a short word', () => {
		expect(match('mlik', 'milk')).toBeUndefined();
		expect(match('sut', 'süt')).toEqual({ typos: 0, quality: 0 });
	});

	it('finds a word still being typed, with or without a typo', () => {
		expect(match('chick', 'Chicken breast')).toEqual({ typos: 0, quality: 1 });
		expect(match('chikce', 'Chicken breast')).toEqual({ typos: 1, quality: 3 });
	});

	it('adds the changes of every word, and fails when one word matches nothing', () => {
		expect(match('chiken brest', 'Chicken breast')).toEqual({ typos: 2, quality: 3 });
		expect(match('chicken zzzzz', 'Chicken breast')).toBeUndefined();
	});
});
