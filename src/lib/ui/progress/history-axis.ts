// Date labels along the history charts' x axis: weekdays for a week, a few dates for a month, month starts beyond
// (every third month past about half a year, every sixth past about two years).
import { addDays } from '#lib/shared/diary-rules.ts';
import { shortDate, shortMonth, shortWeekday } from '#lib/shared/format.ts';

export interface AxisLabel {
	date: string;
	label: string;
}

export const dayNumber = (date: string) => Date.parse(`${date}T12:00:00Z`) / 86_400_000;

export function axisLabels(from: string, to: string): AxisLabel[] {
	const span = dayNumber(to) - dayNumber(from);
	const out: AxisLabel[] = [];
	for (let date = from; date <= to; date = addDays(date, 1)) {
		const [, mo, d] = date.split('-').map(Number);
		if (span <= 8) out.push({ date, label: shortWeekday(date) });
		else if (span <= 40) {
			if ([1, 8, 15, 22, 29].includes(d)) out.push({ date, label: shortDate(date) });
		} else if (d === 1) {
			const every = span < 200 ? 1 : span < 800 ? 3 : 6;
			if ((mo - 1) % every === 0) out.push({ date, label: shortMonth(date) });
		}
	}
	return out;
}
