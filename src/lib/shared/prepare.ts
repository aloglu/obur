// Pages prepared ahead (docs/design.md, "Page changes and the saved copies"): while a page is open, the service
// worker fetches the data of the pages likely to be opened next, so a tap shows the page at once with data only
// seconds old. Pure rules shared by the app and the service worker; no I/O.

/** How long a prepared answer may be used. Any write drops all of them at once, so only other devices age them. */
export const PREPARED_FOR_MS = 60_000;
/** A page asked for again within this time is not fetched again. */
export const PREPARED_AGAIN_MS = 10_000;
/** How many pages from the open page's own links are prepared, besides the tabs. */
export const LINKS_PREPARED = 10;

/**
 * What a page change asks for: only the page's own data (the two layouts stay; SvelteKit sends one digit per
 * layer). Every page in the app has the same three layers.
 */
export const PAGE_ONLY = '001';

const INVALIDATED = 'x-sveltekit-invalidated';
const TRAILING_SLASH = 'x-sveltekit-trailing-slash';

/**
 * The address of a page's data as SvelteKit asks for it on a page change (`/journal?month=…` →
 * `/journal/__data.json?month=…&x-sveltekit-invalidated=001`), or an API address unchanged.
 */
export function preparedRequest(href: string, origin: string): string {
	const url = new URL(href, origin);
	if (url.pathname.startsWith('/api/')) return url.href;
	const slash = url.pathname.endsWith('/');
	url.pathname = `${url.pathname.replace(/\/$/, '')}/__data.json`;
	if (slash) url.searchParams.append(TRAILING_SLASH, '1');
	url.searchParams.append(INVALIDATED, PAGE_ONLY);
	return url.href;
}

/** Which layers a request asked for; null when it is not a page-data request that says so. */
export function askedLayers(url: string): string | null {
	return new URL(url).searchParams.get(INVALIDATED);
}

/** The address a prepared answer is kept under: the request without the layers it asked for. */
export function preparedKey(url: string): string {
	const u = new URL(url);
	u.searchParams.delete(INVALIDATED);
	return u.href;
}

/**
 * Whether a prepared answer may answer this request: young enough, and the request asks for exactly what was
 * prepared (a page change asks for the page only; a refresh after a save asks for more and goes to the server).
 */
export function mayAnswer(
	prepared: { at: number; layers: string | null },
	requestUrl: string,
	now: number
): boolean {
	return now - prepared.at < PREPARED_FOR_MS && askedLayers(requestUrl) === prepared.layers;
}

/** API answers a page needs as it opens, prepared together with it. */
const API_FOR_PAGE: Record<string, string[]> = {
	'/log': ['/api/v1/diary/recent', '/api/v1/saved-meals']
};

/**
 * Everything to prepare: the tabs, the open page's own links (in reading order, up to LINKS_PREPARED), and
 * anything a page marks for it, with the API answers those pages need. Same-origin app pages only; never the
 * open page itself, sign-in pages, or files to download.
 */
export function toPrepare(input: {
	tabs: string[];
	links: string[];
	marked: string[];
	current: string;
	origin: string;
}): string[] {
	const out = new Set<string>();
	const add = (href: string) => {
		let url: URL;
		try {
			url = new URL(href, input.origin);
		} catch {
			return;
		}
		if (url.origin !== input.origin) return;
		url.hash = '';
		const path = url.pathname;
		if (/^\/(login|setup|join|recover)(\/|$)/.test(path)) return;
		if (path.startsWith('/api/') && !input.marked.includes(href)) return;
		const local = path + url.search;
		if (local === input.current) return;
		out.add(local);
		for (const api of API_FOR_PAGE[path] ?? []) out.add(api);
	};
	for (const href of input.tabs) add(href);
	for (const href of input.marked) add(href);
	let links = 0;
	for (const href of input.links) {
		if (links >= LINKS_PREPARED) break;
		const before = out.size;
		add(href);
		if (out.size > before) links++;
	}
	return [...out];
}
