// Drafts for the owner to choose between: versions of an icon still in question. The chosen one moves to its family
// file and the rest are deleted. Names start with draft_.
import { svg } from '../lib.ts';
import { banana } from './fruit.ts';

export const drafts: Record<string, string> = {};

// Banana version B (picked), at three angles with the stalk upper left as in the earlier drawings.
for (const [v, angle] of [
	['a', 25],
	['b', 40],
	['c', 55]
] as const)
	drafts[`draft_banana_${v}`] = svg(
		`<g transform="rotate(${angle} 512 512)">${banana(620, 128, 52, 215)}</g>`
	);
