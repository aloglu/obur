// Which page sits inside which (docs/ui.md, "Back button" and "Page changes"): the same tree the "<" on each nested
// page follows. A page change down the tree slides the new page in from the right; up the tree it slides away;
// anything else (the tabs, a link across) dissolves. Pure; no I/O.

const PARENTS: [RegExp, string][] = [
	[/^\/(foods|recipes|saved-meals|household|help)$/, '/more'],
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

/** How a page change moves: `in` down the tree, `back` up it, `across` for anything else. */
export function pageDirection(from: string, to: string): 'in' | 'back' | 'across' {
	if (from === to) return 'across';
	if (ancestors(to).includes(from)) return 'in';
	if (ancestors(from).includes(to)) return 'back';
	return 'across';
}
