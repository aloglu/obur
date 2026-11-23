import { readdirSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { ADMIN_PAGES, appPages, pagesFor } from './app-pages.ts';

describe('appPages', () => {
	it('lists every page of the app, the tabs first, without onboarding or pages outside the app', () => {
		expect(
			appPages([
				'(app)/settings/data/+page.svelte',
				'(app)/+page.svelte',
				'(app)/foods/[id]/+page.svelte',
				'(app)/log/+page.svelte',
				'(app)/onboarding/+page.svelte',
				'(app)/more/+page.svelte',
				'(app)/+layout.svelte',
				'login/+page.svelte',
				'(app)\\recipes\\new\\+page.svelte'
			])
		).toEqual([
			'/(app)',
			'/(app)/log',
			'/(app)/more',
			'/(app)/foods/[id]',
			'/(app)/recipes/new',
			'/(app)/settings/data'
		]);
	});
});

describe('pagesFor', () => {
	const pages = ['/(app)', '/(app)/members', '/(app)/server', '/(app)/more'];
	it('leaves out the admin pages for everyone else', () => {
		expect(pagesFor(pages, false)).toEqual(['/(app)', '/(app)/more']);
		expect(pagesFor(pages, true)).toEqual(pages);
	});

	it('knows every page whose loader lets only admins in', () => {
		const loaders = readdirSync('src/routes/(app)', { recursive: true, encoding: 'utf8' })
			.map((f) => f.replace(/\\/g, '/'))
			.filter((f) => f.endsWith('+page.server.ts'));
		const adminOnly = loaders
			.filter((f) =>
				/role !== 'admin'\) redirect/.test(readFileSync(`src/routes/(app)/${f}`, 'utf8'))
			)
			.map((f) => `/(app)/${f.replace(/\/?\+page\.server\.ts$/, '')}`);
		expect(adminOnly.length).toBeGreaterThan(0);
		expect(adminOnly.filter((id) => !ADMIN_PAGES.has(id))).toEqual([]);
	});
});
