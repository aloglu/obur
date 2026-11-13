// The application's updates instance: this build's version and where the published ones are listed. The list is
// GitHub's public tag list for obur's repository; the request carries no account, cookie or installation detail.
// `UPDATES_TEST_URL` points it at a stand-in for browser tests.
import { UPDATES_TEST_URL } from '$app/env/private';
import { createUpdates } from '#lib/server/modules/updates/index.ts';
import { db } from './db/index.ts';

const SOURCE = UPDATES_TEST_URL
	? `${UPDATES_TEST_URL}/updates/tags`
	: 'https://api.github.com/repos/aloglu/obur/tags?per_page=100';

async function published(): Promise<string[]> {
	const response = await fetch(SOURCE, {
		headers: { accept: 'application/vnd.github+json', 'user-agent': 'obur' },
		redirect: 'error',
		signal: AbortSignal.timeout(4000)
	});
	if (!response.ok) throw new Error(`status ${response.status}`);
	const body: unknown = await response.json();
	if (!Array.isArray(body)) throw new Error('unexpected answer');
	return body
		.map((tag: unknown) => (tag as { name?: unknown } | null)?.name)
		.filter((name): name is string => typeof name === 'string');
}

export const updates = createUpdates(db, { current: __OBUR_VERSION__, published });
