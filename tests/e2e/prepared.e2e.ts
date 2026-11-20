// Pages prepared ahead (docs/design.md, "Page changes and the saved copies"): a tab opens from data the service
// worker fetched before the tap, and a change made in the app is never hidden behind a prepared copy.
import { expect, test, type Page } from '@playwright/test';
import { signedInAs } from './fixtures.ts';

const tabs = (page: Page) =>
	page.getByRole('navigation', { name: 'Main' }).filter({ visible: true });

/** Today, with the service worker in charge and the next pages prepared. */
async function settledOnToday(page: Page) {
	await page.goto('/');
	await page.evaluate(() => navigator.serviceWorker.ready);
	// The worker takes charge of the page on the next load.
	await page.reload();
	await expect(page.getByRole('heading', { level: 1, name: 'Today' })).toBeVisible();
	await page.waitForFunction(() => navigator.serviceWorker.controller !== null);
	// Preparing starts a moment after the page settles; on the local server it takes a few hundred ms.
	await page.waitForTimeout(2500);
}

test('a tab opens from its prepared data, without waiting for the server', async ({
	page,
	context
}, testInfo) => {
	// Only Chromium lets a test hold back the service worker's own requests.
	test.skip(testInfo.project.name !== 'desktop-chromium', 'needs Chromium request routing');
	await signedInAs(page, 'Ready Ahead');
	await settledOnToday(page);

	// From now on the server takes 5 s to answer Journal; a prepared copy does not ask it.
	await context.route('**/journal/__data.json*', async (route) => {
		await new Promise((r) => setTimeout(r, 5000));
		await route.continue().catch(() => {});
	});
	const started = Date.now();
	await tabs(page).getByRole('link', { name: 'Journal' }).click();
	await expect(page.getByRole('heading', { level: 1, name: 'Journal' })).toBeVisible();
	expect(Date.now() - started).toBeLessThan(2000);
	await context.unroute('**/journal/__data.json*');
});

test('a prepared page is not shown once the device has no connection', async ({
	page,
	context
}, testInfo) => {
	// 2026-11-20 audit (R13). Chromium tells the service worker the device is offline.
	test.skip(testInfo.project.name !== 'desktop-chromium', 'needs Chromium offline emulation');
	await signedInAs(page, 'Ready Offline');
	await settledOnToday(page);
	await context.setOffline(true);
	await tabs(page).getByRole('link', { name: 'Journal' }).click();
	await expect(
		page.getByRole('heading', { level: 1, name: 'obur needs a connection' })
	).toBeVisible();
	await context.setOffline(false);
});

test('nothing prepared is used once the server answers without a session', async ({
	page,
	context
}, testInfo) => {
	// 2026-11-20 audit (R13): signed out on another device, this one kept showing pages prepared before it.
	test.skip(testInfo.project.name !== 'desktop-chromium', 'needs Chromium request routing');
	await signedInAs(page, 'Ready Gone');
	await settledOnToday(page);
	// The session ends on the server, not through this page.
	const out = await page.request.post('/api/v1/auth/logout', {
		data: {},
		headers: { origin: new URL(page.url()).origin }
	});
	expect(out.ok()).toBe(true);
	// Any answer through the service worker now says there is no session (a page that was not prepared).
	await page.evaluate(() => fetch('/help/__data.json?x-sveltekit-invalidated=001'));
	await context.route('**/journal/__data.json*', async (route) => {
		await new Promise((r) => setTimeout(r, 3000));
		await route.continue().catch(() => {});
	});
	await tabs(page).getByRole('link', { name: 'Journal' }).click();
	await page.waitForTimeout(1500);
	await expect(page.getByRole('heading', { level: 1, name: 'Journal' })).toBeHidden();
	await expect(page).toHaveURL(/\/login/, { timeout: 10_000 });
	await context.unroute('**/journal/__data.json*');
});

test('a change made in the app shows on a page prepared before it', async ({ page }) => {
	await signedInAs(page, 'Never Stale');
	await settledOnToday(page);
	// Journal was prepared with nothing logged today.
	const month = page.getByRole('region', { name: /^[A-Z][a-z]+ \d{4}$/ });

	// Logged through the app (as every save is), after Journal was prepared.
	const zone = await page.evaluate(() => Intl.DateTimeFormat().resolvedOptions().timeZone);
	const status = await page.evaluate(
		async ({ zone }) => {
			const now = new Date();
			const date = new Intl.DateTimeFormat('en-CA', { timeZone: zone }).format(now);
			const response = await fetch('/api/v1/diary/entries', {
				method: 'POST',
				headers: { 'content-type': 'application/json' },
				body: JSON.stringify({
					kind: 'quick',
					date,
					meal: 'lunch',
					zone,
					kcal: 120,
					description: null
				})
			});
			return response.status;
		},
		{ zone }
	);
	expect(status).toBeLessThan(300);

	await tabs(page).getByRole('link', { name: 'Journal' }).click();
	await expect(page.getByRole('heading', { level: 1, name: 'Journal' })).toBeVisible();
	await expect(month).toContainText('120');
	await expect(month).not.toContainText('Nothing logged');
});

test('Members opens with its people already listed', async ({ page }) => {
	await signedInAs(page, 'Listed Admin', 'admin');
	await page.goto('/more');
	await page
		.getByRole('main')
		.getByRole('link', { name: /Members/ })
		.click();
	// Nothing fetched after the page opens: the list is there as soon as the page is.
	await expect(page.getByRole('heading', { level: 1, name: 'Members' })).toBeVisible();
	expect(await page.getByRole('main').textContent()).toContain('Listed Admin');
});
