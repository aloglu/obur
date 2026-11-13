// The service worker's saved copies of page data (SvelteKit's `__data.json`), for use without a connection.
// A page change asks only for the parts it needs, and the answer marks the rest as skipped, so a saved copy is
// built up: each answer replaces the parts it carries and keeps the others. Pure text in, text out.

/** One part per layout and one for the page, as SvelteKit sends them; `skip` stands for "not asked for". */
type Part = { type: string } | null;
interface PageData {
	type: 'data';
	nodes: Part[];
}

function read(text: string | undefined): PageData | undefined {
	if (text === undefined) return undefined;
	try {
		const value = JSON.parse(text) as Partial<PageData> | null;
		return value?.type === 'data' && Array.isArray(value.nodes) ? (value as PageData) : undefined;
	} catch {
		// Not one JSON document (a streamed answer, an error page): not something to build on.
		return undefined;
	}
}

const skipped = (part: Part) => part?.type === 'skip';

/**
 * What to save after a fresh answer: the answer laid over the copy already saved. Undefined when it should not
 * be saved: it is not page data, or it lacks the page itself and there is no earlier copy to supply it.
 */
export function mergePageData(saved: string | undefined, fresh: string): string | undefined {
	const next = read(fresh);
	if (!next) return undefined;
	if (!next.nodes.some(skipped)) return fresh;
	const before = read(saved);
	if (!before || before.nodes.length !== next.nodes.length) {
		// The page's own part comes last. Without it the copy could not open the page.
		return skipped(next.nodes.at(-1) ?? null) ? undefined : fresh;
	}
	return JSON.stringify({
		...next,
		nodes: next.nodes.map((part, i) => (skipped(part) ? before.nodes[i] : part))
	});
}

/**
 * A saved copy as the answer to a request that asked only for some parts (`asked` is SvelteKit's
 * `x-sveltekit-invalidated` value, one digit per part): the others are marked skipped, so the page keeps what it
 * already shows instead of going back to an older copy.
 */
export function answerFromCopy(saved: string, asked: string | null): string {
	const copy = read(saved);
	if (!copy || asked === null || asked.length !== copy.nodes.length) return saved;
	return JSON.stringify({
		...copy,
		nodes: copy.nodes.map((part, i) => (asked[i] === '1' ? part : part && { type: 'skip' }))
	});
}

/**
 * The answer when the server cannot be reached and there is no copy to give, for a request that only refreshes
 * what pages share and did not ask for the page itself (its last digit is 0): every part skipped, so the page keeps
 * what it shows. Undefined when the page itself was asked for: that needs a real answer.
 */
export function nothingNew(asked: string | null): string | undefined {
	if (!asked || !/^[01]+0$/.test(asked)) return undefined;
	return JSON.stringify({ type: 'data', nodes: [...asked].map(() => ({ type: 'skip' })) });
}
