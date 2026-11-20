// SvelteKit's page data (`__data.json`), as the service worker sees it. Pure text in, text out.

/**
 * The answer when the server cannot be reached, for a request that only refreshes what pages share and did not ask
 * for the page itself (`asked` is SvelteKit's `x-sveltekit-invalidated`, one digit per part; its last digit is 0):
 * every part skipped, so the page keeps what it shows. Undefined when the page itself was asked for: that needs a
 * real answer.
 */
export function nothingNew(asked: string | null): string | undefined {
	if (!asked || !/^[01]+0$/.test(asked)) return undefined;
	return JSON.stringify({ type: 'data', nodes: [...asked].map(() => ({ type: 'skip' })) });
}
