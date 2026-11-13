import { describe, expect, it } from 'vitest';
import { pageDirection, parentOf, tabOf } from './page-tree.ts';

describe('parentOf', () => {
	it('follows the back arrows', () => {
		expect(parentOf('/more/settings')).toBe('/more');
		expect(parentOf('/more/appearance')).toBe('/more/settings');
		expect(parentOf('/settings/security')).toBe('/more/settings');
		expect(parentOf('/profile')).toBe('/more/settings');
		expect(parentOf('/foods')).toBe('/more');
		expect(parentOf('/foods/new')).toBe('/foods');
		expect(parentOf('/foods/0b6f1c1e-0000-4000-8000-000000000000')).toBe('/foods');
		expect(parentOf('/recipes/new')).toBe('/recipes');
		expect(parentOf('/achievements')).toBe('/progress');
		expect(parentOf('/scan')).toBe('/log');
	});

	it('gives tabs and pages outside the tree no parent', () => {
		for (const tab of ['/', '/log', '/journal', '/progress', '/more', '/onboarding', '/offline'])
			expect(parentOf(tab)).toBeNull();
	});
});

describe('pageDirection', () => {
	it('goes in down the tree, however many levels', () => {
		expect(pageDirection('/more', '/more/settings')).toBe('in');
		expect(pageDirection('/more/settings', '/more/appearance')).toBe('in');
		expect(pageDirection('/more', '/foods/abc')).toBe('in');
	});

	it('goes back up the tree, however many levels', () => {
		expect(pageDirection('/more/appearance', '/more/settings')).toBe('back');
		expect(pageDirection('/foods/abc', '/more')).toBe('back');
	});

	it('slides to another tab from the side it sits on, from wherever under a tab', () => {
		expect(pageDirection('/', '/log')).toBe('right');
		expect(pageDirection('/progress', '/journal')).toBe('left');
		expect(pageDirection('/foods/abc', '/progress')).toBe('left');
		expect(pageDirection('/achievements', '/more/settings')).toBe('right');
	});

	it('does not move for siblings under one tab, pages outside the tree, or the same page', () => {
		expect(pageDirection('/more/appearance', '/more/units')).toBeNull();
		expect(pageDirection('/foods/abc', '/recipes')).toBeNull();
		expect(pageDirection('/more', '/onboarding')).toBeNull();
		expect(pageDirection('/more', '/more')).toBeNull();
	});
});

describe('tabOf', () => {
	it('finds the tab a page sits under', () => {
		expect(tabOf('/')).toBe(0);
		expect(tabOf('/scan')).toBe(1);
		expect(tabOf('/achievements')).toBe(3);
		expect(tabOf('/settings/security')).toBe(4);
		expect(tabOf('/onboarding')).toBeNull();
	});
});
