import { readdirSync } from 'node:fs';
import path from 'node:path';
import { expect, test, type Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { apiAs, createFood, signedInAs } from './fixtures.ts';

test.setTimeout(600_000);
// Automated checks (axe, WCAG 2.2 A and AA) on every page at rest, light and dark: the signed-in pages with some
// content, and the public sign-in, setup, join and recovery pages. They supplement keyboard and screen-reader checks
// rather than prove accessibility (docs/design.md, "Testing and definition of done"). Interactive states have their
// own tests (sheet-keyboard, large-text).

/** Every page route (`/(app)/foods/[id]`), from the route files: a new page without a check fails the test (A41). */
function pageRoutes(
	dir = path.resolve(import.meta.dirname, '../../src/routes'),
	at = ''
): string[] {
	return readdirSync(dir, { withFileTypes: true }).flatMap((e) =>
		e.isDirectory()
			? pageRoutes(path.join(dir, e.name), `${at}/${e.name}`)
			: e.name === '+page.svelte'
				? [at || '/']
				: []
	);
}

async function axe(page: Page, label: string, out: string[]) {
	await page.waitForLoadState('networkidle').catch(() => {});
	await page.waitForTimeout(300);
	await page.evaluate(async () => {
		await document.fonts.ready;
		await Promise.all(document.getAnimations().map((x) => x.finished.catch(() => {})));
	});
	const check = () =>
		new AxeBuilder({ page })
			.withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'])
			// Zoom is off on purpose (owner, 2026-11-14; docs/ui.md, "No zooming"); text follows the phone's
			// text size instead, checked in large-text.e2e.ts.
			.disableRules(['meta-viewport'])
			.analyze();
	let r = await check();
	// Under load a page can be caught mid-paint; a real problem is still there a second later.
	if (r.violations.length) {
		await page.waitForTimeout(1000);
		r = await check();
	}
	for (const v of r.violations)
		out.push(
			`${label} [${v.impact}] ${v.id}: ${v.help}\n   ${v.nodes
				.slice(0, 3)
				.map(
					(n) =>
						n.target.join(' ') + ' :: ' + (n.failureSummary ?? '').split('\n').slice(1, 2).join('')
				)
				.join('\n   ')}`
		);
}

test('the public pages pass the automated accessibility checks in light and dark', async ({
	page
}, info) => {
	test.skip(info.project.name !== 'phone-webkit', 'one browser is enough');
	const out: string[] = [];
	for (const dark of [false, true]) {
		await page.emulateMedia({ colorScheme: dark ? 'dark' : 'light', reducedMotion: 'reduce' });
		for (const path of ['/login', '/setup', '/join', '/recover']) {
			await page.goto(path);
			await axe(page, `${dark ? 'dark' : 'light'} ${path}`, out);
		}
	}
	expect(out, out.join('\n')).toEqual([]);
});

test('every signed-in page passes the automated accessibility checks in light and dark', async ({
	page
}, info) => {
	test.skip(info.project.name !== 'phone-webkit', 'one browser is enough');
	await signedInAs(page, 'Gülşen Karaosmanoğlu', 'admin');
	await page.goto('/');
	const today = await page.evaluate(() => new Date().toLocaleDateString('en-CA'));
	const food = await createFood(page, {
		name: 'Ev yapımı mercimek çorbası',
		basis: '100g',
		nutrients: [{ code: 'energy_kcal', value: 92, qualifier: 'reported' }]
	});
	await apiAs(page, 'POST', '/api/v1/diary/entries', {
		kind: 'food',
		foodId: food,
		amount: 250,
		unit: { kind: 'mass', unit: 'g' },
		date: today,
		meal: 'lunch',
		zone: 'Europe/Istanbul'
	});
	await apiAs(page, 'POST', '/api/v1/body/weight', {
		id: crypto.randomUUID(),
		date: today,
		zone: 'Europe/Istanbul',
		value: 72.4
	});
	// An archived food, and one in Recently deleted, so the archive and the trash's groups have rows.
	const kept = await createFood(page, {
		name: 'Old protein bar',
		basis: '100g',
		nutrients: [{ code: 'energy_kcal', value: 380, qualifier: 'reported' }]
	});
	const gone = await createFood(page, {
		name: 'Old iced latte',
		basis: '100ml',
		nutrients: [{ code: 'energy_kcal', value: 40, qualifier: 'reported' }]
	});
	await apiAs(page, 'POST', '/api/v1/foods/bulk', { action: 'archive', ids: [kept, gone] });
	await apiAs(page, 'POST', '/api/v1/foods/bulk', { action: 'delete', ids: [gone] });
	// A recipe and a saved meal, for their own pages.
	const recipe = crypto.randomUUID();
	await apiAs(page, 'PUT', `/api/v1/recipes/${recipe}`, {
		version: null,
		name: 'Mercimek köftesi',
		icon: null,
		servings: 4,
		cookedYieldG: null,
		ingredients: [{ foodId: food, amount: 400, unit: { kind: 'mass', unit: 'g' } }]
	});
	const day = await apiAs<{ entries: { id: string }[] }>(page, 'GET', `/api/v1/diary/${today}`);
	const meal = await apiAs<{ id: string }>(page, 'POST', '/api/v1/saved-meals', {
		name: 'Öğle yemeği',
		entryIds: [day.entries[0].id]
	});
	const pages = [
		'/',
		'/log',
		'/journal',
		'/progress',
		'/achievements',
		'/more',
		'/more/settings',
		'/more/appearance',
		'/more/units',
		'/more/speak-and-scan',
		'/more/goal',
		'/more/deleted',
		'/profile',
		'/foods',
		'/foods/new',
		`/foods/${food}`,
		'/foods/archived',
		`/foods/${kept}`,
		'/recipes/archived',
		'/recipes',
		'/recipes/new',
		`/recipes/${recipe}`,
		'/saved-meals',
		'/saved-meals/new',
		`/saved-meals/${meal.id}`,
		'/scan',
		'/settings/data',
		'/settings/reminders',
		'/settings/security',
		'/members',
		'/server',
		'/help',
		'/onboarding'
	];
	// Every page route is checked here or in the public test above (dynamic ones through the IDs made above).
	const checked = new Set([
		...pages.map((p) =>
			p.replace(food, '[id]').replace(kept, '[id]').replace(recipe, '[id]').replace(meal.id, '[id]')
		),
		'/login',
		'/setup',
		'/join',
		'/recover'
	]);
	const unchecked = pageRoutes()
		.map((r) => r.replace('/(app)', '') || '/')
		.filter((r) => !checked.has(r));
	expect(unchecked, 'pages without an accessibility check').toEqual([]);
	const out: string[] = [];
	for (const dark of [false, true]) {
		await page.emulateMedia({ colorScheme: dark ? 'dark' : 'light', reducedMotion: 'reduce' });
		for (const path of pages) {
			await page.goto(path);
			await axe(page, `${dark ? 'dark' : 'light'} ${path}`, out);
		}
	}
	// The "Already in your foods" card, which only a save can show.
	for (const dark of [false, true]) {
		await page.emulateMedia({ colorScheme: dark ? 'dark' : 'light', reducedMotion: 'reduce' });
		await page.goto('/foods/new');
		await page.getByLabel('Name', { exact: true }).fill('Ev yapımı mercimek çorbası');
		await page.locator('#n-energy_kcal').fill('92');
		await page.getByRole('button', { name: 'Save food' }).click();
		await expect(page.getByRole('region', { name: 'Already in your foods' })).toBeVisible();
		await page.evaluate(async () => {
			await Promise.all(document.getAnimations().map((x) => x.finished.catch(() => {})));
		});
		await axe(page, `${dark ? 'dark' : 'light'} already-in-foods`, out);
	}
	expect(out, out.join('\n')).toEqual([]);
});
