// Typed (and spoken) entries: the pure parser's proposals matched to the person's foods and portions. Proposes only;
// the client shows everything for confirmation and saves through the ordinary create endpoints.
import {
	parseEntry,
	proposeForFood,
	type ParsedUnit
} from '#lib/server/modules/nl-parser/index.ts';
import { addDays, localDate } from '#lib/shared/diary-rules.ts';
import type { EntryItem, ParsedEntry, SaidUnit } from '#lib/shared/entry-types.ts';
import { catalog } from './catalog.ts';
import { diary } from './diary.ts';

const said = (u: ParsedUnit | null): SaidUnit => (!u ? null : u.kind === 'count' ? u.word : u.kind);

/** ISO weekday (1 = Monday) of a YYYY-MM-DD date. */
const isoWeekday = (date: string) => ((new Date(`${date}T12:00:00Z`).getUTCDay() + 6) % 7) + 1;

export async function understandEntry(
	userId: string,
	text: string,
	viewed: string,
	zone: string
): Promise<ParsedEntry> {
	const today = localDate(new Date(), zone);
	const parsed = parseEntry(text, isoWeekday(today));
	const date =
		parsed.daysAgo !== null ? addDays(today, -parsed.daysAgo) : viewed <= today ? viewed : today;
	const needsFoods = parsed.items.some((i) => i.kind === 'food');
	const recent = needsFoods ? await diary.recentFoodIds(userId, 50) : [];
	const measures = parsed.items.some((i) => i.kind === 'water')
		? await catalog.householdMeasures()
		: [];

	const items: EntryItem[] = [];
	for (const p of parsed.items) {
		if (p.kind === 'food') {
			const candidates = await catalog.searchFoodsLoose(userId, p.text, 5, recent);
			const food = candidates[0] ? await catalog.getFood(userId, candidates[0].id) : null;
			const proposed = food
				? proposeForFood(p.amount, p.unit, food)
				: { unit: null, amount: p.amount };
			items.push({
				kind: 'food',
				text: p.text,
				candidates,
				food,
				amount: proposed.amount,
				unit: proposed.unit,
				said: said(p.unit),
				vague: p.vague
			});
		} else if (p.kind === 'water') {
			// A glass is the seeded "su bardağı" household measure; a bottle has no stated size, so it is asked.
			const glass = measures.find((m) => m.code === 'su_bardagi');
			const ml =
				p.amount === null
					? null
					: p.unit?.kind === 'ml'
						? p.amount
						: p.unit?.kind === 'count' && p.unit.word === 'glass' && glass
							? p.amount * glass.ml
							: null;
			items.push({ kind: 'water', ml, amount: p.amount, said: said(p.unit) });
		} else items.push(p);
	}
	return { heard: text, date, meal: parsed.meal, items };
}
