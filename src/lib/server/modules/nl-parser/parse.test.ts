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

	it('reads commas between groups of three as thousands, any other comma as a decimal mark', () => {
		const first = (text: string) => parseEntry(text, TODAY_WEEKDAY).items[0];
		expect(first('2,000 kcal')).toEqual({ kind: 'quick', kcal: 2000, description: null });
		expect(first('1,000 g yoghurt')).toMatchObject({ text: 'yoghurt', amount: 1000 });
		expect(first('1,5 kg elma')).toMatchObject({ text: 'elma', amount: 1500 });
		expect(first('0,250 kg peynir')).toMatchObject({ text: 'peynir', amount: 250 });
		expect(first('12,50 g cheese')).toMatchObject({ amount: 12.5 });
	});

	it('converts ounces and pounds to grams and fluid ounces to millilitres', () => {
		const first = (text: string) => parseEntry(text, TODAY_WEEKDAY).items[0];
		expect(first('10 oz steak')).toMatchObject({ text: 'steak', unit: { kind: 'g' } });
		expect((first('10 oz steak') as { amount: number }).amount).toBeCloseTo(283.495, 3);
		expect((first('2 lbs chicken') as { amount: number }).amount).toBeCloseTo(907.185, 3);
		expect(first('8 fl oz orange juice')).toMatchObject({
			text: 'orange juice',
			unit: { kind: 'ml' }
		});
		expect((first('8 fluid ounces milk') as { amount: number }).amount).toBeCloseTo(236.588, 3);
	});
});
