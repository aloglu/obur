// Typed in-app links with query strings. Each starts from resolve() and only appends a query, so the result is
// still a resolved pathname (satisfies svelte/no-navigation-without-resolve).
import { resolve } from '$app/paths';
import type { ResolvedPathname } from '$app/types';
import type { Meal } from '#lib/shared/diary-types.ts';

const withQuery = (
	path: ResolvedPathname,
	params: Record<string, string | undefined>
): ResolvedPathname => {
	const query = new URLSearchParams(
		Object.entries(params).filter((e): e is [string, string] => e[1] !== undefined)
	).toString();
	return (query ? `${path}?${query}` : path) as ResolvedPathname;
};

/** Today view of a day, optionally highlighting just-saved entries (all of them, when several were logged). */
export const dayHref = (date: string, highlight?: string | string[]) =>
	withQuery(resolve('/(app)'), {
		date,
		highlight: Array.isArray(highlight) ? highlight.join(',') || undefined : highlight
	});

/** The Log tab with a preset meal and day. */
export const logHref = (meal: Meal, date: string) =>
	withQuery(resolve('/(app)/log'), { meal, date });

/** The Log tab for a meal and day, with a search already typed (another food for a refused entry). */
export const logSearchHref = (meal: Meal, date: string, q: string) =>
	withQuery(resolve('/(app)/log'), { meal, date, q });

/** The Log tab with a food's amount sheet open (nothing is logged until Save). */
export const logFoodHref = (foodId: string) => withQuery(resolve('/(app)/log'), { food: foodId });

/** The Journal, opened on a day when coming from one in the past. */
export const journalHref = (day: string | null) =>
	day ? withQuery(resolve('/(app)/journal'), { day }) : resolve('/(app)/journal');

/** Log with the Scan sheet open. */
export const scanSheetHref = () => withQuery(resolve('/(app)/log'), { scan: '1' });

/** Foods with a food just saved highlighted (and shown even when it is further down the list). */
export const foodsSavedHref = (foodId: string) =>
	withQuery(resolve('/(app)/foods'), { saved: foodId });
