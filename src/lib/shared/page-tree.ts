// Which page sits inside which (docs/ui.md, "Back button" and "Page changes"): the same tree the "<" on each nested
// page follows. On phones a page change down the tree pushes the new page in from the right and up the tree slides it
// away; a change to another tab slides the screens sideways in tab order. Pure; no I/O.

const PARENTS: [RegExp, string][] = [
	[/^\/(foods|recipes|saved-meals|members|help)$/, '/more'],
	[/^\/more\/(settings|deleted)$/, '/more'],
	[
		/^\/(profile|more\/(goal|units|appearance|speak-and-scan)|settings\/(reminders|security|data))$/,
		'/more/settings'
	],
	[/^\/foods\/[^/]+$/, '/foods'],
	[/^\/recipes\/[^/]+$/, '/recipes'],
	[/^\/saved-meals\/[^/]+$/, '/saved-meals'],
	[/^\/achievements$/, '/progress'],
	[/^\/scan$/, '/log']
];

/** The page one level up, or null for a top-level page (a tab) or one outside the tree. */
export function parentOf(path: string): string | null {
	for (const [pattern, parent] of PARENTS) if (pattern.test(path)) return parent;
	return null;
}

function ancestors(path: string): string[] {
	const out: string[] = [];
	for (let p = parentOf(path); p !== null; p = parentOf(p)) out.push(p);
	return out;
}

/** The tabs, in the order the tab bar shows them. */
const TABS = ['/', '/log', '/journal', '/progress', '/more'];

/** The tab a page sits under (its own tab for a tab), or null for a page outside the tree. */
export function tabOf(path: string): number | null {
	const top = [path, ...ancestors(path)].at(-1) ?? path;
	const at = TABS.indexOf(top);
	return at === -1 ? null : at;
}

/**
 * How a page change moves on a phone: `in` down the tree, `back` up it, `right` or `left` to a page under another
 * tab (the new screen comes from that side, as the tabs are laid out), or null for anything else, which changes at
 * once.
 */
export function pageDirection(from: string, to: string): 'in' | 'back' | 'right' | 'left' | null {
	if (from === to) return null;
	if (ancestors(to).includes(from)) return 'in';
	if (ancestors(from).includes(to)) return 'back';
	const a = tabOf(from);
	const b = tabOf(to);
	if (a === null || b === null || a === b) return null;
	return b > a ? 'right' : 'left';
}
