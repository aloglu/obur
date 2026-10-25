// Display formatting shared by screens. Interface strings come from the message catalog; this file only formats
// numbers, days and quantities.
import { m } from '#lib/paraglide/messages.js';
import { addDays } from './diary-rules.ts';
import type { Meal, SnapshotUnit } from './diary-types.ts';
import { formatDecimal } from './numbers.ts';

export const mealName = (meal: Meal): string =>
	({
		breakfast: m.meal_breakfast,
		lunch: m.meal_lunch,
		dinner: m.meal_dinner,
		snacks: m.meal_snacks
	})[meal]();

export const kcal = (value: number): string => String(Math.round(value));

// Formatted by hand so every browser and the server produce identical text (Intl output differs by engine).
const WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const MONTHS = [
	'January',
	'February',
	'March',
	'April',
	'May',
	'June',
	'July',
	'August',
	'September',
	'October',
	'November',
	'December'
];

function parts(iso: string) {
	const [y, mo, d] = iso.split('-').map(Number);
	const weekday = new Date(Date.UTC(y, mo - 1, d)).getUTCDay();
	return { y, mo, d, weekday };
}

/** "Today", "Yesterday" or "Tue 20 Oct". */
export function dayTitle(date: string, today: string): string {
	if (date === today) return m.day_today();
	if (date === addDays(today, -1)) return m.day_yesterday();
	const { mo, d, weekday } = parts(date);
	return `${WEEKDAYS[weekday].slice(0, 3)} ${d} ${MONTHS[mo - 1].slice(0, 3)}`;
}

/** "Tuesday 20 October". */
export function dayAndMonth(date: string): string {
	const { mo, d, weekday } = parts(date);
	return `${WEEKDAYS[weekday]} ${d} ${MONTHS[mo - 1]}`;
}

/** "October 2026". */
export function monthTitle(month: string): string {
	const [y, mo] = month.split('-').map(Number);
	return `${MONTHS[mo - 1]} ${y}`;
}

/** "Tuesday 20 October 2026". */
export function longDate(date: string): string {
	const { y, mo, d, weekday } = parts(date);
	return `${WEEKDAYS[weekday]} ${d} ${MONTHS[mo - 1]} ${y}`;
}

const UNIT_LABEL: Record<string, string> = {
	g: 'g',
	kg: 'kg',
	oz: 'oz',
	lb: 'lb',
	ml: 'ml',
	l: 'l',
	us_cup: 'US cup',
	metric_cup: 'cup (250 ml)',
	us_fl_oz: 'US fl oz',
	imp_fl_oz: 'UK fl oz'
};

/** "52 g", "3 × slice (26 g)", "1 × Su bardağı (200 ml)", "1 bar", "2 × 1 bar". */
export function quantityText(
	amount: number,
	unit: SnapshotUnit,
	servingLabel: string | null
): string {
	const n = formatDecimal(amount, ',', 2);
	switch (unit.kind) {
		case 'mass':
		case 'volume':
			return `${n} ${UNIT_LABEL[unit.unit]}`;
		case 'measure':
			return `${n} × ${unit.name} (${formatDecimal(unit.ml, ',', 0)} ml)`;
		case 'serving':
			return `${n} × ${unit.name} (${formatDecimal(unit.amount, ',', 1)} ${unit.unit})`;
		case 'basis_serving':
			return amount === 1 ? (servingLabel ?? '1') : `${n} × ${servingLabel ?? ''}`;
	}
}

export const unitLabel = (unit: string): string => UNIT_LABEL[unit] ?? unit;
