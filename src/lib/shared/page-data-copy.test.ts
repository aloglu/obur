import { describe, expect, it } from 'vitest';
import { answerFromCopy, mergePageData, nothingNew } from './page-data-copy.ts';

const data = (...nodes: unknown[]) => JSON.stringify({ type: 'data', nodes });
const part = (value: string) => ({ type: 'data', data: [value], uses: {} });
const skip = { type: 'skip' };

describe('mergePageData', () => {
	it('saves a complete answer as it is', () => {
		const fresh = data(part('root'), part('app'), part('page'));
		expect(mergePageData(data(part('old'), part('old'), part('old')), fresh)).toBe(fresh);
		expect(mergePageData(undefined, fresh)).toBe(fresh);
	});

	it('keeps the saved parts an answer skipped and replaces the ones it carries', () => {
		const saved = data(part('root 1'), part('app 1'), part('page 1'));
		expect(mergePageData(saved, data(skip, skip, part('page 2')))).toBe(
			data(part('root 1'), part('app 1'), part('page 2'))
		);
		expect(mergePageData(saved, data(part('root 2'), part('app 2'), skip))).toBe(
			data(part('root 2'), part('app 2'), part('page 1'))
		);
	});

	it('saves a first answer that has the page, and not one without it', () => {
		const pageOnly = data(skip, skip, part('page'));
		expect(mergePageData(undefined, pageOnly)).toBe(pageOnly);
		expect(mergePageData(undefined, data(part('root'), part('app'), skip))).toBeUndefined();
	});

	it('a page without data of its own (null) is not a missing page', () => {
		const fresh = data(part('root'), skip, null);
		expect(mergePageData(undefined, fresh)).toBe(fresh);
	});

	it('does not build on a copy of another shape, or save what is not page data', () => {
		const pageOnly = data(skip, skip, part('page'));
		expect(mergePageData(data(part('root'), part('page')), pageOnly)).toBe(pageOnly);
		expect(mergePageData('<html>', pageOnly)).toBe(pageOnly);
		expect(mergePageData(undefined, '{"type":"redirect","location":"/login"}')).toBeUndefined();
		expect(mergePageData(undefined, 'not json')).toBeUndefined();
		// A streamed answer: several documents, one per line.
		expect(mergePageData(undefined, `${data(part('a'))}\n{"type":"chunk"}`)).toBeUndefined();
	});
});

describe('answerFromCopy', () => {
	const saved = data(part('root'), part('app'), part('page'));

	it('gives only the parts asked for', () => {
		expect(answerFromCopy(saved, '001')).toBe(data(skip, skip, part('page')));
		expect(answerFromCopy(saved, '111')).toBe(saved);
	});

	it('gives the whole copy when nothing says which parts, or it does not fit', () => {
		expect(answerFromCopy(saved, null)).toBe(saved);
		expect(answerFromCopy(saved, '01')).toBe(saved);
		expect(answerFromCopy('not json', '001')).toBe('not json');
	});

	it('leaves a page without data of its own as it is', () => {
		expect(answerFromCopy(data(part('root'), part('app'), null), '100')).toBe(
			data(part('root'), skip, null)
		);
	});
});

describe('nothingNew', () => {
	it('answers a refresh of the shared parts with nothing changed', () => {
		expect(nothingNew('110')).toBe(data(skip, skip, skip));
		expect(nothingNew('10')).toBe(data(skip, skip));
	});

	it('has no answer when the page itself was asked for, or everything was', () => {
		expect(nothingNew('001')).toBeUndefined();
		expect(nothingNew('111')).toBeUndefined();
		expect(nothingNew(null)).toBeUndefined();
		expect(nothingNew('')).toBeUndefined();
	});
});
