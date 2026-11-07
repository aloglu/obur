import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

// iPhones zoom the page in when a field whose text is under 16 px gets focus, so each one states a size of at least that.
// Placeholders may be smaller: they don't count.
const svelteFiles = (dir: string): string[] =>
	readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
		const path = join(dir, e.name);
		if (e.isDirectory()) return svelteFiles(path);
		return e.name.endsWith('.svelte') ? [path] : [];
	});

const fields = ['src/lib', 'src/routes']
	.flatMap(svelteFiles)
	.flatMap((file) =>
		[...readFileSync(file, 'utf8').matchAll(/<(?:input|select|textarea)\b[\s\S]*?(?:\/>|\n\s*>)/g)]
			.map((match) => ({ file, tag: match[0] }))
			.filter(({ tag }) => !/type="(?:checkbox|file)"/.test(tag))
	);

describe('form fields', () => {
	it('finds the fields', () => {
		expect(fields.length).toBeGreaterThan(10);
	});

	it.each(fields)('$file: text of at least 16 px', ({ tag }) => {
		const sizes = [...tag.matchAll(/(?<![:\w-])text-\[(\d+(?:\.\d+)?)px\]/g)].map((s) =>
			Number(s[1])
		);
		expect(sizes.length, tag).toBeGreaterThan(0);
		expect(Math.min(...sizes), tag).toBeGreaterThanOrEqual(16);
	});
});
