// How a food search matches a food (docs/design.md, "Search rule"), word by word, as search tools usually do. Both
// the query and the food's search text are folded first (shared/search-text.ts), so case, accents and Turkish
// letters cost nothing: "yogurt" finds "yoğurt". Pure: strings in, a verdict out.
//
// - Every query word must match the start of a word in the food's search text, in any order.
// - A query word that matches no word start may differ from one by letter changes (one wrong, missing, extra or
//   swapped letter is one change): none for words of up to 4 letters, 1 for 5 to 8, 2 for 9 or more. It is
//   compared with the start of each word, so a word still being typed counts too.

/** The changes a query word of this length may have. */
export function typosAllowed(word: string): number {
	const n = word.length;
	return n <= 4 ? 0 : n <= 8 ? 1 : 2;
}

// Rows of the table that counts changes, kept between calls: a search compares thousands of words.
let rows = [new Int32Array(32), new Int32Array(32), new Int32Array(32)];

/**
 * The last row of the change table from `a` to `b` (optimal string alignment: a swap of two neighbours is one
 * change): its entry j is the changes from `a` to the first j letters of `b`. Undefined as soon as every entry is
 * certain to be more than `max`.
 */
function lastRow(a: string, b: string, max: number): Int32Array | undefined {
	if (rows[0].length <= b.length) rows = rows.map(() => new Int32Array(b.length * 2 + 1));
	let [before, previous, current] = rows;
	for (let j = 0; j <= b.length; j++) previous[j] = j;
	for (let i = 1; i <= a.length; i++) {
		current[0] = i;
		let best = i;
		for (let j = 1; j <= b.length; j++) {
			const cost = a[i - 1] === b[j - 1] ? 0 : 1;
			let d = Math.min(previous[j] + 1, current[j - 1] + 1, previous[j - 1] + cost);
			if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1])
				d = Math.min(d, before[j - 2] + 1);
			current[j] = d;
			if (d < best) best = d;
		}
		if (best > max) return undefined;
		[before, previous, current] = [previous, current, before];
	}
	return previous;
}

/** Letter changes from `a` to `b`, or `max + 1` as soon as it is certain to be more than `max`. */
export function changes(a: string, b: string, max: number): number {
	if (Math.abs(a.length - b.length) > max) return max + 1;
	const row = lastRow(a, b, max);
	return row ? Math.min(row[b.length], max + 1) : max + 1;
}

/** The fewest changes that make `word` the start of `keyWord`, or undefined past what the word may have. */
function wordChanges(word: string, keyWord: string): number | undefined {
	if (keyWord.startsWith(word)) return 0;
	const max = typosAllowed(word);
	if (max === 0) return undefined;
	const n = word.length;
	// The start of the key word may be a little shorter or longer than the typed word (a letter missing or extra).
	const start = keyWord.slice(0, n + max);
	const row = lastRow(word, start, max);
	if (!row) return undefined;
	let best = max + 1;
	for (let len = Math.max(1, n - max); len <= start.length; len++) best = Math.min(best, row[len]);
	return best <= max ? best : undefined;
}

export interface FoodMatch {
	/** Letter changes needed, over all words; 0 is a real match. */
	typos: number;
	/** How closely the whole query matches: 0 the whole text, 1 its start, 2 a word's start, 3 anywhere. */
	quality: number;
}

/** Splits a folded query into the words that are matched (at most 8). */
export const queryWords = (folded: string): string[] =>
	folded.split(' ').filter(Boolean).slice(0, 8);

/** Whether a food's folded search text matches the folded query, and how well; undefined when it doesn't. */
export function matchFood(folded: string, key: string): FoodMatch | undefined {
	const words = queryWords(folded);
	if (words.length === 0) return undefined;
	const keyWords = key.split(' ').filter(Boolean);
	let typos = 0;
	for (const word of words) {
		let best: number | undefined;
		for (const keyWord of keyWords) {
			const c = wordChanges(word, keyWord);
			if (c !== undefined && (best === undefined || c < best)) best = c;
			if (best === 0) break;
		}
		if (best === undefined) return undefined;
		typos += best;
	}
	const q = words.join(' ');
	const quality = key === q ? 0 : key.startsWith(q) ? 1 : ` ${key}`.includes(` ${q}`) ? 2 : 3;
	return { typos, quality };
}
