import { describe, expect, it } from 'vitest';
import { appPages } from './app-pages.ts';

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
