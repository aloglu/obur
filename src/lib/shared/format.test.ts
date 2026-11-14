import { describe, expect, it } from 'vitest';
import {
	dateWithYear,
	dayBoxTitle,
	dayHeading,
	dayTitle,
	longDate,
	quantityText,
	shortDay,
	shortMonth,
	weekdayShort
} from './format.ts';
import { overwriteLocale } from './test-locale.ts';

describe('format', () => {
	it('titles days the same way in every engine', () => {
		expect(dayTitle('2026-10-25', '2026-10-25')).toBe('Today');
		expect(dayTitle('2026-10-24', '2026-10-25')).toBe('Yesterday');
		expect(dayTitle('2026-10-20', '2026-10-25')).toBe('Tue 20 Oct');
		expect(dayTitle('2025-12-31', '2026-01-02')).toBe('Wed 31 Dec');
		expect(longDate('2026-10-20')).toBe('Tuesday 20 October 2026');
		expect(longDate('2028-02-29')).toBe('Tuesday 29 February 2028');
		expect(dateWithYear('1992-04-12')).toBe('12 April 1992');
	});

	it('writes dates in Turkish order, with its own short names', () => {
		const tr = <T>(fn: () => T) => overwriteLocale('tr', fn);
		expect(tr(() => dayTitle('2026-10-25', '2026-10-25'))).toBe('Bugün');
		expect(tr(() => dayTitle('2026-10-20', '2026-10-25'))).toBe('20 Eki Sal');
		expect(tr(() => longDate('2026-10-20'))).toBe('20 Ekim 2026 Salı');
		expect(tr(() => dayHeading('2026-10-20', '2026-10-20'))).toEqual({
			title: 'Bugün',
			detail: '20 Ekim Salı'
		});
		expect(tr(() => dayHeading('2026-10-12', '2026-10-25'))).toEqual({
			title: '12 Ekim',
			detail: 'Pazartesi'
		});
		// The Journal's day box spells the month out in Turkish (owner, 2026-11-14).
		expect(tr(() => dayBoxTitle('2026-11-10', '2026-11-14'))).toBe('10 Kasım Salı');
		expect(dayBoxTitle('2026-11-10', '2026-11-14')).toBe('Tuesday 10 Nov');
		expect(tr(() => shortDay('2026-11-10'))).toBe('10 Kas Sal');
		expect(tr(() => shortMonth('2027-01-01'))).toBe('Oca ’27');
		expect(tr(() => dateWithYear('1992-04-12'))).toBe('12 Nisan 1992');
		// In a sentence ("… gününden beri") Turkish uses the whole weekday.
		expect(tr(() => weekdayShort('2026-11-12'))).toBe('Perşembe');
		expect(weekdayShort('2026-11-12')).toBe('Thu');
	});

	it('describes quantities with the language’s decimal mark and readable portions', () => {
		expect(quantityText(225, { kind: 'mass', unit: 'g' }, null)).toBe('225 g');
		expect(quantityText(1.5, { kind: 'volume', unit: 'us_cup' }, null)).toBe('1.5 US cup (237 ml)');
		expect(quantityText(1, { kind: 'basis_serving' }, '1 bar')).toBe('1 bar');
		expect(quantityText(2, { kind: 'basis_serving' }, '1 bar')).toBe('2 × 1 bar');
		expect(
			quantityText(
				3,
				{ kind: 'serving', servingId: 'a', name: 'slice', amount: 26, unit: 'g' },
				null
			)
		).toBe('3 × slice (26 g)');
		expect(
			quantityText(2, { kind: 'measure', code: 'su_bardagi', name: 'Su bardağı', ml: 200 }, null)
		).toBe('2 × Water glass (200 ml)');
	});
});

describe('dayHeading', () => {
	const today = '2026-11-06'; // a Friday
	it.each([
		['2026-11-06', 'Today', 'Friday 6 November'],
		['2026-11-05', 'Yesterday', 'Thursday 5 November'],
		['2026-11-02', 'Monday', '2 November'], // this week's Monday
		['2026-11-01', '1 November', 'Sunday'], // last week
		['2025-12-31', '31 December 2025', 'Wednesday'] // the year only for other years
	])('%s reads %s / %s', (date, title, detail) => {
		expect(dayHeading(date, today)).toEqual({ title, detail });
	});

	it('shows the year on Today only if today is in another year than itself: never', () => {
		expect(dayHeading(today, today).detail).not.toContain('2026');
	});
});
