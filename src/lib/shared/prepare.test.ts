import { describe, expect, it } from 'vitest';
import {
	LINKS_PREPARED,
	PREPARED_FOR_MS,
	askedLayers,
	mayAnswer,
	preparedKey,
	preparedRequest,
	toPrepare
} from './prepare.ts';

const ORIGIN = 'https://obur.example';

describe('preparedRequest', () => {
	it('asks for a page as SvelteKit does on a page change', () => {
		expect(preparedRequest('/journal', ORIGIN)).toBe(
			`${ORIGIN}/journal/__data.json?x-sveltekit-invalidated=001`
		);
		expect(preparedRequest('/journal?month=2026-10', ORIGIN)).toBe(
			`${ORIGIN}/journal/__data.json?month=2026-10&x-sveltekit-invalidated=001`
		);
	});

	it('marks the root page with a trailing slash, after its own query', () => {
		expect(preparedRequest('/', ORIGIN)).toBe(
			`${ORIGIN}/__data.json?x-sveltekit-trailing-slash=1&x-sveltekit-invalidated=001`
		);
		expect(preparedRequest('/?date=2026-11-12', ORIGIN)).toBe(
			`${ORIGIN}/__data.json?date=2026-11-12&x-sveltekit-trailing-slash=1&x-sveltekit-invalidated=001`
		);
	});

	it('leaves API addresses as they are', () => {
		expect(preparedRequest('/api/v1/diary/recent', ORIGIN)).toBe(`${ORIGIN}/api/v1/diary/recent`);
	});
});

describe('keys and answers', () => {
	const pageChange = `${ORIGIN}/journal/__data.json?x-sveltekit-invalidated=001`;
	const refresh = `${ORIGIN}/journal/__data.json?x-sveltekit-invalidated=111`;

	it('keeps an answer under the page, whatever layers were asked for', () => {
		expect(preparedKey(pageChange)).toBe(`${ORIGIN}/journal/__data.json`);
		expect(preparedKey(refresh)).toBe(`${ORIGIN}/journal/__data.json`);
		expect(askedLayers(pageChange)).toBe('001');
		expect(askedLayers(`${ORIGIN}/api/v1/diary/recent`)).toBeNull();
	});

	it('answers a page change while young, never a refresh that asks for more', () => {
		const prepared = { at: 1000, layers: '001' };
		expect(mayAnswer(prepared, pageChange, 1000 + PREPARED_FOR_MS - 1)).toBe(true);
		expect(mayAnswer(prepared, pageChange, 1000 + PREPARED_FOR_MS)).toBe(false);
		expect(mayAnswer(prepared, refresh, 1001)).toBe(false);
	});

	it('answers an API request with an API answer', () => {
		const url = `${ORIGIN}/api/v1/diary/recent`;
		expect(mayAnswer({ at: 0, layers: askedLayers(url) }, url, 10)).toBe(true);
	});
});

describe('toPrepare', () => {
	const base = { tabs: [], links: [], marked: [], current: '/', origin: ORIGIN };

	it('prepares the tabs, never the open page, and Log with the lists it shows', () => {
		expect(toPrepare({ ...base, tabs: ['/', '/log', '/journal'], current: '/journal' })).toEqual([
			'/',
			'/log',
			'/api/v1/diary/recent',
			'/api/v1/saved-meals'
		]);
	});

	it('takes the open page’s links in order, up to the limit, without repeats or sign-in pages', () => {
		const links = [
			'/foods',
			'/foods',
			'/login',
			`${ORIGIN}/recipes#top`,
			'https://github.com/x',
			...Array.from({ length: 20 }, (_, i) => `/foods/${i}`)
		];
		const out = toPrepare({ ...base, current: '/more', links });
		expect(out.slice(0, 3)).toEqual(['/foods', '/recipes', '/foods/0']);
		expect(out).toHaveLength(LINKS_PREPARED);
	});

	it('adds what a page marks, an API answer included, but no API link it did not mark', () => {
		expect(
			toPrepare({
				...base,
				marked: ['/?date=2026-11-12', '/api/v1/foods/abc'],
				links: ['/api/v1/export']
			})
		).toEqual(['/?date=2026-11-12', '/api/v1/foods/abc']);
	});
});
