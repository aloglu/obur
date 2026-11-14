// The application's updates instance: this build's version and where the published ones are listed. The list is
// GitHub's public tag list for obur's repository; the request carries no account, cookie or installation detail.
// `UPDATES_TEST_URL` points it at a stand-in for browser tests.
import { UPDATES_TEST_URL } from '$app/env/private';
import { createUpdates } from '#lib/server/modules/updates/index.ts';
import { db } from './db/index.ts';

const SOURCE = UPDATES_TEST_URL
	? `${UPDATES_TEST_URL}/updates/tags`
	: 'https://api.github.com/repos/aloglu/obur/tags?per_page=100';

/** GitHub lists 100 tags a page; a few pages are plenty, and the next page is only ever GitHub's own address. */
const MAX_PAGES = 5;

/** The page after this one, from GitHub's Link header, when it is on the same host. */
export function nextPage(link: string | null, current: string): string | null {
	const next = link?.match(/<([^>]+)>;\s*rel="next"/)?.[1];
	if (!next) return null;
	try {
		return new URL(next).host === new URL(current).host ? next : null;
	} catch {
		return null;
	}
}

async function published(): Promise<string[]> {
	const names: string[] = [];
	let url: string | null = SOURCE;
	for (let page = 0; url && page < MAX_PAGES; page++) {
		const response: Response = await fetch(url, {
			headers: { accept: 'application/vnd.github+json', 'user-agent': 'obur' },
			redirect: 'error',
			signal: AbortSignal.timeout(4000)
		});
		if (!response.ok) throw new Error(`status ${response.status}`);
		const body: unknown = await response.json();
		if (!Array.isArray(body)) throw new Error('unexpected answer');
		for (const tag of body) {
			const name = (tag as { name?: unknown } | null)?.name;
			if (typeof name === 'string') names.push(name);
		}
		url = nextPage(response.headers.get('link'), url);
	}
	return names;
}

export const updates = createUpdates(db, { current: __OBUR_VERSION__, published });
