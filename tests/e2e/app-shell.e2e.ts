import { expect, test } from '@playwright/test';
import { apiAs, createFood, signedInAs } from './fixtures.ts';

test('signed-out visitors land on sign-in, served with self-hosted assets only', async ({
	page,
	baseURL
}) => {
	const origin = new URL(baseURL!).origin;
	const external: string[] = [];
	page.on('request', (request) => {
		const url = new URL(request.url());
		if (url.protocol.startsWith('http') && url.origin !== origin) external.push(url.href);
	});

	await page.goto('/');
	await expect(page).toHaveURL(/\/login$/);
	await expect(page.getByRole('heading', { level: 1, name: 'Sign in' })).toBeVisible();
	await page.waitForLoadState('networkidle');

	// No telemetry, CDNs or font services at runtime (CLAUDE.md, security and privacy invariants).
	expect(external).toEqual([]);
	const fontsLoaded = await page.evaluate(async () => {
		await document.fonts.ready;
		return [...document.fonts].filter((f) => f.status === 'loaded').map((f) => f.family);
	});
	expect(fontsLoaded.join(' ')).toMatch(/Inter Variable/);
	expect(fontsLoaded.join(' ')).toMatch(/Bricolage Grotesque Variable/);
});

test('sends hardening headers and rejects cross-site state changes', async ({
	request,
	baseURL
}) => {
	const res = await request.get('/login');
	expect(res.headers()['content-security-policy']).toContain("default-src 'self'");
	expect(res.headers()['referrer-policy']).toBe('no-referrer');

	const crossSite = await request.post('/api/v1/auth/login/options', {
		headers: { origin: 'https://evil.example' },
		data: {}
	});
	expect(crossSite.status()).toBe(403);
	const sameSite = await request.post('/api/v1/auth/login/options', {
		headers: { origin: new URL(baseURL!).origin },
		data: {}
	});
	expect(sameSite.status()).toBe(200);

	const unauthenticated = await request.get('/api/v1/auth/credentials');
	expect(unauthenticated.status()).toBe(401);
});

test('signed out with entries waiting: the card says whose they are and never covers the name', async ({
	page
}) => {
	await page.goto('/login');
	await page.evaluate(() =>
		localStorage.setItem(
			'obur:waiting',
			JSON.stringify({ someone: { name: 'Selin Yılmaz-Karaosmanoğlu', count: 3 } })
		)
	);
	await page.reload();
	const card = page.getByRole('alert').filter({ hasText: '3 entries are waiting on this device' });
	await expect(card).toContainText('nobody else sees them');
	const name = await page.getByText('obur', { exact: true }).boundingBox();
	const top = await page.getByRole('alert').first().boundingBox();
	expect(name!.y + name!.height).toBeLessThanOrEqual(top!.y);
	await expect(page.getByRole('button', { name: 'Sign in with a passkey' })).toBeInViewport();
});

test('every page title sits at the same height and stays there while a page opens', async ({
	page
}) => {
	await page.goto('/login');
	await signedInAs(page, 'Title Height');
	// The top of the title's letters, not of its box: boxes differ (a page with a "<" has a taller one).
	const titleTop = () =>
		page.evaluate(() => {
			const range = document.createRange();
			range.selectNodeContents(document.querySelector('h1')!);
			return Math.round(range.getBoundingClientRect().top * 2) / 2;
		});
	const settled = () =>
		page.evaluate(async () => {
			await document.fonts.ready;
			await Promise.all(document.getAnimations().map((a) => a.finished.catch(() => {})));
		});
	const tops: Record<string, number> = {};
	for (const path of [
		'/',
		'/log',
		'/journal',
		'/progress',
		'/more',
		'/more/settings',
		'/more/appearance',
		'/settings/security',
		'/settings/data',
		'/profile',
		'/foods',
		'/recipes',
		'/saved-meals',
		'/household',
		'/help',
		'/achievements'
	]) {
		await page.goto(path);
		await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
		await settled();
		tops[path] = await titleTop();
	}
	const expected = Object.fromEntries(Object.keys(tops).map((path) => [path, tops['/more']]));
	expect(tops).toEqual(expected);

	// A page rises into place as it opens; its title does not (measured at once, while the page still moves).
	await page.goto('/more');
	await settled();
	for (const [link, title] of [
		['Settings', 'Settings'],
		['Appearance', 'Appearance'],
		['Settings', 'Settings'],
		['More', 'More']
	]) {
		await page.getByRole('main').getByRole('link', { name: link }).first().click();
		await page.waitForFunction(
			(t) => document.querySelector('h1')?.textContent?.trim() === t,
			title
		);
		expect(await titleTop()).toBe(tops['/more']);
	}
});

test('Log keeps its recent foods between visits, and Today’s title stays still unless the day changes', async ({
	page
}, testInfo) => {
	const name = `Keep Toast ${testInfo.project.name}`;
	await page.goto('/login');
	await signedInAs(page, 'Quick Return');
	const foodId = await createFood(page, {
		name,
		basis: '100g',
		nutrients: [{ code: 'energy_kcal', value: 250, qualifier: 'reported' }]
	});
	await apiAs(page, 'POST', '/api/v1/diary/entries', {
		date: '2026-10-20',
		zone: 'Europe/London',
		kind: 'food',
		meal: 'breakfast',
		foodId,
		amount: 100,
		unit: { kind: 'mass', unit: 'g' }
	});
	const tabs = page.getByRole('navigation', { name: 'Main' }).filter({ visible: true });
	const recentFood = page.getByRole('region', { name: 'Recent' }).getByRole('button', {
		name: new RegExp(name)
	});

	await page.goto('/');
	await tabs.getByRole('link', { name: 'Log' }).click();
	await expect(recentFood).toBeVisible();
	await tabs.getByRole('link', { name: 'Today' }).click();
	await expect(page.getByRole('heading', { level: 1, name: 'Today' })).toBeVisible();

	// The server is slow now: Log shows what it had at once, rather than starting empty and waiting.
	await page.route('**/api/v1/diary/recent', async (route) => {
		await new Promise((r) => setTimeout(r, 4000));
		await route.continue().catch(() => {});
	});
	await tabs.getByRole('link', { name: 'Log' }).click();
	await expect(recentFood).toBeVisible({ timeout: 1500 });
	await page.unroute('**/api/v1/diary/recent');

	// Today's title animates when the day changes, never on arriving, on tapping Today again, or on a refresh.
	const titleMoved = () =>
		page.evaluate(() =>
			document.getAnimations().some((a) => (a as CSSAnimation).animationName === 'day-title-in')
		);
	await tabs.getByRole('link', { name: 'Today' }).click();
	await expect(page.getByRole('heading', { level: 1, name: 'Today' })).toBeVisible();
	expect(await titleMoved()).toBe(false);
	const reload = page.waitForResponse((r) => r.url().includes('__data.json'));
	await tabs.getByRole('link', { name: 'Today' }).click();
	await reload;
	await page.waitForTimeout(100);
	expect(await titleMoved()).toBe(false);
	await page.getByRole('button', { name: 'Previous day' }).click();
	await expect(page.getByRole('heading', { level: 1, name: 'Yesterday' })).toBeVisible();
	expect(await titleMoved()).toBe(true);
});
