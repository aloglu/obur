// The Turkish catalog (docs/design.md, "Interface language"; terms in docs/tr-glossary.md) matches the English one.
import { readdirSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const read = (lang: string): Record<string, string> =>
	JSON.parse(readFileSync(`messages/${lang}.json`, 'utf8'));
const en = read('en');
const tr = read('tr');
const placeholders = (text: string) => [...new Set(text.match(/\{\w+\}/g) ?? [])].sort();

describe('the Turkish messages', () => {
	it('has every message the English catalog has', () => {
		expect(Object.keys(en).filter((k) => !(k in tr))).toEqual([]);
	});

	it('only has keys the English catalog has', () => {
		expect(Object.keys(tr).filter((k) => !(k in en))).toEqual([]);
	});

	it('uses the same placeholders as English', () => {
		const differ = Object.keys(tr).filter(
			(k) => JSON.stringify(placeholders(tr[k])) !== JSON.stringify(placeholders(en[k]))
		);
		expect(differ).toEqual([]);
	});

	it('never puts a suffix on a placeholder, which would not agree with every name', () => {
		expect(Object.keys(tr).filter((k) => /\}['’]?[a-zçğıöşü]/i.test(tr[k]))).toEqual([]);
	});
});

describe('the English messages', () => {
	it('are each used somewhere in the code', () => {
		// A message is used when its name appears in the code, or when the code builds names from its prefix
		// (`help_${id}_q`). Anything else is a leftover from a screen that changed.
		const files = (dir: string): string[] =>
			readdirSync(dir, { withFileTypes: true }).flatMap((e) =>
				e.isDirectory()
					? e.name === 'paraglide'
						? []
						: files(`${dir}/${e.name}`)
					: /\.(ts|svelte)$/.test(e.name) && !e.name.endsWith('.test.ts')
						? [`${dir}/${e.name}`]
						: []
			);
		const code = files('src')
			.map((f) => readFileSync(f, 'utf8'))
			.join('\n');
		const names = new Set(code.match(/\w+/g));
		const prefixes = [...code.matchAll(/`([a-z]\w*_)\$\{/g)].map((p) => p[1]);
		const unused = Object.keys(en).filter(
			(k) => k !== '$schema' && !names.has(k) && !prefixes.some((p) => k.startsWith(p))
		);
		expect(unused).toEqual([]);
	});
});
