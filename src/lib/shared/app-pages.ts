// The app's pages, for reading their code in ahead of the first visit (routes/(app)/+layout.svelte). The build finds
// them in src/routes/(app) (vite.config.ts), so a new page is never left out (2026-11-20 audit, R13; the list was
// written by hand and had missed seven pages). Pure: no I/O.

/** Read in first, in this order: the tabs, then the pages opened from them most. */
const FIRST = ['/(app)', '/(app)/log', '/(app)/journal', '/(app)/progress', '/(app)/more'];
/** Opened once, and never from another page. */
const NEVER = new Set(['/(app)/onboarding']);

/**
 * Route IDs (`/(app)/foods/[id]`) from page files relative to src/routes (`(app)/foods/[id]/+page.svelte`), the
 * tabs first and the rest in name order.
 */
export function appPages(files: string[]): string[] {
	const ids = files
		.map((f) => f.replace(/\\/g, '/'))
		.filter((f) => f.startsWith('(app)/') || f === '(app)/+page.svelte')
		.filter((f) => f.endsWith('+page.svelte'))
		.map((f) => `/${f.replace(/\/?\+page\.svelte$/, '')}`)
		.filter((id) => !NEVER.has(id));
	const rest = ids.filter((id) => !FIRST.includes(id)).sort();
	return [...FIRST.filter((id) => ids.includes(id)), ...rest];
}

/** Pages only an admin can open (their loaders send anyone else away). */
export const ADMIN_PAGES = new Set(['/(app)/members', '/(app)/server']);

/** The pages worth reading in for this person: an admin's own pages only for an admin (Gemini audit 2, H16). */
export const pagesFor = (pages: string[], isAdmin: boolean) =>
	isAdmin ? pages : pages.filter((id) => !ADMIN_PAGES.has(id));
