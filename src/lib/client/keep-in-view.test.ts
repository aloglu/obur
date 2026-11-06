import { describe, expect, it } from 'vitest';
import { scrollNeeded } from './keep-in-view.ts';

describe('scrollNeeded', () => {
	it('stays put when the field already clears the keyboard', () => {
		expect(scrollNeeded({ top: 100, bottom: 300 }, 400, 0)).toBe(0);
	});

	it('scrolls just far enough, with a margin', () => {
		expect(scrollNeeded({ top: 500, bottom: 700 }, 400, 0)).toBe(312);
	});

	it('never pushes the top of a tall field out of view', () => {
		expect(scrollNeeded({ top: 100, bottom: 900 }, 400, 0)).toBe(88);
	});

	it('does not scroll back when the top is already above the visible area', () => {
		expect(scrollNeeded({ top: -50, bottom: 900 }, 400, 0)).toBe(0);
	});
});
