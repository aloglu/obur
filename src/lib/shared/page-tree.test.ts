import { describe, expect, it } from 'vitest';
import { pageDirection, parentOf } from './page-tree.ts';

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

	it('goes across between tabs, siblings, and anything outside the tree', () => {
		expect(pageDirection('/', '/log')).toBe('across');
		expect(pageDirection('/more/appearance', '/more/units')).toBe('across');
		expect(pageDirection('/foods/abc', '/progress')).toBe('across');
		expect(pageDirection('/more', '/onboarding')).toBe('across');
		expect(pageDirection('/more', '/more')).toBe('across');
	});
});
