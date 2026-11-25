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

	it("keeps the unit said with a weigh-in, or none for the person's own", () => {
		const weight = (text: string) => parseEntry(text, TODAY_WEEKDAY).items;
		expect(weight('I weighed 180 lb today')).toEqual([{ kind: 'weight', value: 180, unit: 'lb' }]);
		expect(weight('weight 185.2 pounds')).toEqual([{ kind: 'weight', value: 185.2, unit: 'lb' }]);
		expect(weight('weighed 180lbs')).toEqual([{ kind: 'weight', value: 180, unit: 'lb' }]);
		expect(weight('weight 82.4 kg')).toEqual([{ kind: 'weight', value: 82.4, unit: 'kg' }]);
		expect(weight('I weighed 180 this morning')).toEqual([
			{ kind: 'weight', value: 180, unit: null }
		]);
	});

	it('reads "last <weekday>" as the most recent past one, never today', () => {
		expect(parseEntry('geçen cuma 80 kiloydum', 5).daysAgo).toBe(7);
		expect(parseEntry('last saturday 80 kilos weighed', 5).daysAgo).toBe(6);
		// A number no diary day is that far back is not a date (G26).
		expect(parseEntry('40000 days ago 80 kilos', 5).daysAgo).toBeNull();
		expect(parseEntry('3 days ago 80 kilos', 5).daysAgo).toBe(3);
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

describe('parseEntry: cases from the 2026-11-25 Review.md audit (1.10)', () => {
	const items = (text: string) => parseEntry(text, TODAY_WEEKDAY).items;

	it('reads Turkish numbers ending in "bir"', () => {
		expect(items('seksen bir kiloydum')).toEqual([{ kind: 'weight', value: 81, unit: 'kg' }]);
		expect(items('yirmi bir gram fındık')).toEqual([
			{ kind: 'food', text: 'fındık', amount: 21, unit: { kind: 'g' }, vague: false }
		]);
		expect(items('yüz bir gram peynir')[0]).toMatchObject({ amount: 101, unit: { kind: 'g' } });
		expect(items('on bir gram ceviz')[0]).toMatchObject({ amount: 11, unit: { kind: 'g' } });
	});

	it('keeps a percentage written after its number in the food name', () => {
		expect(items('2% milk, 250 ml')).toEqual([
			{ kind: 'food', text: '%2 milk', amount: 250, unit: { kind: 'ml' }, vague: false }
		]);
		expect(items('0% Greek yogurt, 150g')).toEqual([
			{ kind: 'food', text: '%0 Greek yogurt', amount: 150, unit: { kind: 'g' }, vague: false }
		]);
	});

	it('takes the calories of an activity and the weight of a weigh-in, not the first number', () => {
		expect(items('Ran for an hour and burned 600 calories')[0]).toMatchObject({
			kind: 'activity',
			kcal: 600
		});
		expect(items('I ran for 30 minutes and burned 450 calories')[0]).toMatchObject({
			kind: 'activity',
			kcal: 450
		});
		expect(items('after 2 coffees I weighed 81.5 kg')).toEqual([
			{ kind: 'weight', value: 81.5, unit: 'kg' }
		]);
	});

	it('reads a leading decimal point and thousands with decimals', () => {
		expect(items('.5 lb ground beef')[0]).toMatchObject({
			text: 'ground beef',
			amount: 0.5 * 453.59237
		});
		expect(items('1,250.5 kcal')).toEqual([{ kind: 'quick', kcal: 1250.5, description: null }]);
	});
});
