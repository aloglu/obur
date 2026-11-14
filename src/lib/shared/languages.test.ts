import { describe, expect, it } from 'vitest';
import { locales } from '#lib/paraglide/runtime.js';
import { ENABLED_LANGUAGES, fromAcceptLanguage, pickLanguage, usable } from './languages.ts';

const BOTH = ['en', 'tr'] as const;

describe('the interface language', () => {
	it('only enables languages that have a message catalog', () => {
		for (const lang of ENABLED_LANGUAGES) expect(locales).toContain(lang);
	});

	it('follows the cookie first, then the phone, then English', () => {
		expect(pickLanguage('tr', 'en-GB,en;q=0.9', BOTH)).toBe('tr');
		expect(pickLanguage(undefined, 'tr-TR,tr;q=0.9,en;q=0.8', BOTH)).toBe('tr');
		expect(pickLanguage(undefined, 'de-DE,de;q=0.9', BOTH)).toBe('en');
		expect(pickLanguage(undefined, undefined, BOTH)).toBe('en');
	});

	it('takes the phone languages in order of preference, skipping ones it lacks', () => {
		expect(fromAcceptLanguage('de;q=1, tr;q=0.5, en;q=0.7', BOTH)).toBe('en');
		expect(fromAcceptLanguage('de, tr', BOTH)).toBe('tr');
		expect(fromAcceptLanguage('tr;q=0, en;q=0.1', BOTH)).toBe('en');
		expect(fromAcceptLanguage('*', BOTH)).toBeUndefined();
	});

	it('never shows a language that is not enabled yet, wherever it comes from', () => {
		const onlyEnglish = ['en'] as const;
		expect(pickLanguage('tr', 'tr-TR', onlyEnglish)).toBe('en');
		expect(usable('tr', onlyEnglish)).toBeUndefined();
		expect(usable('xx', BOTH)).toBeUndefined();
	});
});
