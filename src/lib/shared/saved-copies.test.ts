import { describe, expect, it } from 'vitest';
import { SAVED_COPY_DAYS, savedCopyExpired } from './saved-copies.ts';

const DAY = 24 * 60 * 60 * 1000;
const now = Date.parse('2026-11-14T12:00:00Z');
const httpDate = (ms: number) => new Date(ms).toUTCString();

describe('savedCopyExpired', () => {
	it('keeps copies up to the limit and removes older ones', () => {
		expect(savedCopyExpired(httpDate(now - DAY), now)).toBe(false);
		expect(savedCopyExpired(httpDate(now - SAVED_COPY_DAYS * DAY + 60_000), now)).toBe(false);
		expect(savedCopyExpired(httpDate(now - SAVED_COPY_DAYS * DAY - 60_000), now)).toBe(true);
	});

	it('keeps a copy without a readable date', () => {
		expect(savedCopyExpired(null, now)).toBe(false);
		expect(savedCopyExpired('not a date', now)).toBe(false);
	});
});
