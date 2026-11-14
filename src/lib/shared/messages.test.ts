// The Turkish catalog (docs/design.md, "Interface language"; terms in docs/tr-glossary.md) matches the English one.
import { readFileSync } from 'node:fs';
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
