// Display formatting shared by screens. Interface strings come from the message catalog; this file only formats
// numbers, days and quantities.
import { m } from '#lib/paraglide/messages.js';
import { getLocale } from '#lib/paraglide/runtime.js';
import { addDays } from './diary-rules.ts';
import type { FoodSnapshot, Meal, SnapshotUnit } from './diary-types.ts';
import { formatDecimal } from './numbers.ts';
import { fullFoodName, portionName } from '#lib/shared/curated-names.ts';
import { measureName } from '#lib/shared/measure-names.ts';

export const mealName = (meal: Meal): string =>
	({
		breakfast: m.meal_breakfast,
		lunch: m.meal_lunch,
		dinner: m.meal_dinner,
		snacks: m.meal_snacks
	})[meal]();

export const kcal = (value: number): string => String(Math.round(value));

// Formatted by hand so every browser and the server produce identical text (Intl output differs by engine). One table
// per interface language (docs/design.md, "Interface language"); Turkish puts the day before the weekday
// ("20 Ekim Salı") and its short names are the usual ones (Sal, Eki), not cut from the full name.
const NAMES = {
	en: {
		weekdays: ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'],
		weekdaysShort: ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'],
		months: [
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
		],
		monthsShort: [
			'Jan',
			'Feb',
			'Mar',
			'Apr',
			'May',
			'Jun',
			'Jul',
			'Aug',
			'Sep',
			'Oct',
			'Nov',
			'Dec'
		]
	},
	tr: {
		weekdays: ['Pazar', 'Pazartesi', 'Salı', 'Çarşamba', 'Perşembe', 'Cuma', 'Cumartesi'],
		weekdaysShort: ['Paz', 'Pzt', 'Sal', 'Çar', 'Per', 'Cum', 'Cmt'],
		months: [
			'Ocak',
			'Şubat',
			'Mart',
			'Nisan',
			'Mayıs',
			'Haziran',
			'Temmuz',
			'Ağustos',
			'Eylül',
			'Ekim',
			'Kasım',
			'Aralık'
		],
		monthsShort: [
			'Oca',
			'Şub',
			'Mar',
			'Nis',
			'May',
			'Haz',
			'Tem',
			'Ağu',
			'Eyl',
			'Eki',
			'Kas',
			'Ara'
		]
	}
} as const;

const names = () => NAMES[getLocale()];
const turkish = () => getLocale() === 'tr';

function parts(iso: string) {
	const [y, mo, d] = iso.split('-').map(Number);
	const weekday = new Date(Date.UTC(y, mo - 1, d)).getUTCDay();
	return { y, mo, d, weekday };
}

/** The weekday and the date in the language's order: "Tuesday 20 October", "20 Ekim Salı". */
const withWeekday = (weekday: string, date: string) =>
	turkish() ? `${date} ${weekday}` : `${weekday} ${date}`;

/** "Today", "Yesterday" or "Tue 20 Oct" ("20 Eki Sal"). */
export function dayTitle(date: string, today: string): string {
	if (date === today) return m.day_today();
	if (date === addDays(today, -1)) return m.day_yesterday();
	const { mo, d, weekday } = parts(date);
	const n = names();
	return withWeekday(n.weekdaysShort[weekday], `${d} ${n.monthsShort[mo - 1]}`);
}

/**
 * The day header (docs/ui.md, "Day titles"): Today and Yesterday, the weekday for other days this week (Monday first),
 * then the date with the weekday under it. The year shows only for other years.
 */
export function dayHeading(date: string, today: string): { title: string; detail: string } {
	const { y, mo, d, weekday } = parts(date);
	const n = names();
	const dayMonth = `${d} ${n.months[mo - 1]}${y !== parts(today).y ? ` ${y}` : ''}`;
	const name = n.weekdays[weekday];
	if (date === today) return { title: m.day_today(), detail: withWeekday(name, dayMonth) };
	if (date === addDays(today, -1))
		return { title: m.day_yesterday(), detail: withWeekday(name, dayMonth) };
	const sinceMonday = (parts(today).weekday + 6) % 7;
	if (date >= addDays(today, -sinceMonday)) return { title: name, detail: dayMonth };
	return { title: dayMonth, detail: name };
}

/**
 * The Journal's day box: "Today", or "Tuesday 2 Sep"; the year only for other years. Turkish has room for the whole
 * month (owner, 2026-11-14): "2 Eylül Salı".
 */
export function dayBoxTitle(date: string, today: string): string {
	if (date === today) return m.day_today();
	const { y, mo, d, weekday } = parts(date);
	const n = names();
	const year = y !== parts(today).y ? ` ${y}` : '';
	const month = turkish() ? n.months[mo - 1] : n.monthsShort[mo - 1];
	return withWeekday(n.weekdays[weekday], `${d} ${month}${year}`);
}

/** "Thu", for a sentence ("since Thu"); Turkish says the whole name there ("Perşembe gününden beri"). */
export function weekdayShort(date: string): string {
	const n = names();
	return (turkish() ? n.weekdays : n.weekdaysShort)[parts(date).weekday];
}

/** "Tuesday 20 October" ("20 Ekim Salı"). */
export function dayAndMonth(date: string): string {
	const { mo, d, weekday } = parts(date);
	const n = names();
	return withWeekday(n.weekdays[weekday], `${d} ${n.months[mo - 1]}`);
}

/** "20 Oct". */
export function shortDate(date: string): string {
	const { mo, d } = parts(date);
	return `${d} ${names().monthsShort[mo - 1]}`;
}

/** "Tue". */
export function shortWeekday(date: string): string {
	return names().weekdaysShort[parts(date).weekday];
}

/** A short weekday and date together, in the language's order: "Tue 20 Oct", "20 Eki Sal". */
export function shortDay(date: string): string {
	return withWeekday(shortWeekday(date), shortDate(date));
}

/** "Oct", or "Jan ’27" for January, so a long chart's axis shows where years change. */
export function shortMonth(date: string): string {
	const { y, mo } = parts(date);
	const short = names().monthsShort[mo - 1];
	return mo === 1 ? `${short} ’${String(y).slice(2)}` : short;
}

/** "12 April 1992". */
export function dateWithYear(date: string): string {
	const { y, mo, d } = parts(date);
	return `${d} ${names().months[mo - 1]} ${y}`;
}

/** "October 2026". */
export function monthTitle(month: string): string {
	const [y, mo] = month.split('-').map(Number);
	return `${names().months[mo - 1]} ${y}`;
}

/** "October". */
export function monthName(month: string): string {
	return names().months[Number(month.slice(5, 7)) - 1];
}

/** "Tuesday 20 October 2026" ("20 Ekim 2026 Salı"). */
export function longDate(date: string): string {
	const { y, mo, d, weekday } = parts(date);
	const n = names();
	return withWeekday(n.weekdays[weekday], `${d} ${n.months[mo - 1]} ${y}`);
}

const UNIT_LABELS: Record<'en' | 'tr', Record<string, string>> = {
	en: {
		g: 'g',
		kg: 'kg',
		oz: 'oz',
		lb: 'lb',
		ml: 'ml',
		l: 'l',
		us_cup: 'US cup (237 ml)',
		metric_cup: 'cup (250 ml)',
		us_fl_oz: 'US fl oz',
		imp_fl_oz: 'UK fl oz'
	},
	tr: {
		g: 'g',
		kg: 'kg',
		oz: 'oz',
		lb: 'lb',
		ml: 'ml',
		l: 'l',
		us_cup: 'ABD bardağı (237 ml)',
		metric_cup: 'bardak (250 ml)',
		us_fl_oz: 'ABD sıvı onsu',
		imp_fl_oz: 'İngiliz sıvı onsu'
	}
};

/** "52 g", "3 × slice (26 g)", "1 × Su bardağı (200 ml)", "1 bar", "2 × 1 bar". */
export function quantityText(
	amount: number,
	unit: SnapshotUnit,
	servingLabel: string | null,
	curated?: boolean
): string {
	const n = formatDecimal(amount, 2);
	switch (unit.kind) {
		case 'mass':
		case 'volume':
			return `${n} ${unitLabel(unit.unit)}`;
		case 'measure':
			return `${n} × ${measureName(unit.code, unit.name)} (${formatDecimal(unit.ml, 0)} ml)`;
		case 'serving':
			return `${n} × ${portionName(unit.name, curated)} (${formatDecimal(unit.amount, 1)} ${unit.unit})`;
		case 'basis_serving':
			return amount === 1 ? (servingLabel ?? '1') : `${n} × ${servingLabel ?? ''}`;
	}
}

export const unitLabel = (unit: string): string => UNIT_LABELS[getLocale()][unit] ?? unit;

/** The content of a diary entry or a saved meal's item. */
interface EntryLike {
	kind: 'food' | 'quick';
	food: FoodSnapshot | null;
	amount: number | null;
	unit: SnapshotUnit | null;
	description: string | null;
}

/** "Untad Premium Light Ekmek", or a quick add's description. */
export const entryName = (e: EntryLike): string =>
	e.kind === 'quick' ? (e.description ?? m.entry_quick()) : e.food ? fullFoodName(e.food) : '';

export const entryQuantity = (e: EntryLike): string =>
	e.kind === 'quick'
		? m.entry_quick()
		: quantityText(e.amount!, e.unit!, e.food?.servingLabel ?? null, e.food?.curated);
