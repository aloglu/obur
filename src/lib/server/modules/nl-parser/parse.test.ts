import { describe, expect, it } from 'vitest';
import { DEV_CASES, TODAY_WEEKDAY } from './fixtures.ts';
import { fold, parseEntry } from './parse.ts';

describe('parseEntry: development sentences', () => {
	it.each(DEV_CASES)('%s', (text, expected) => {
		expect(parseEntry(text, TODAY_WEEKDAY)).toEqual(expected);
	});
});

describe('parseEntry: edges', () => {
	it('returns nothing to log for empty or meaningless input', () => {
		expect(parseEntry('', TODAY_WEEKDAY).items).toEqual([]);
		expect(parseEntry('dün akşam', TODAY_WEEKDAY)).toEqual({
			daysAgo: 1,
			meal: 'dinner',
			items: []
		});
		expect(parseEntry('kiloydum', TODAY_WEEKDAY).items).toEqual([]);
	});

	it('reads "last <weekday>" as the most recent past one, never today', () => {
		expect(parseEntry('geçen cuma 80 kiloydum', 5).daysAgo).toBe(7);
		expect(parseEntry('last saturday 80 kilos weighed', 5).daysAgo).toBe(6);
	});

	it('folds Turkish letters for keywords but keeps the words as typed', () => {
		expect(fold('İÇTİM Işık')).toBe('ictim isik');
		expect(parseEntry('ÖĞLEN 100 GRAM ŞEHRİYE', 5)).toEqual({
			daysAgo: null,
			meal: 'lunch',
			items: [{ kind: 'food', text: 'ŞEHRİYE', amount: 100, unit: { kind: 'g' }, vague: false }]
		});
	});
});
