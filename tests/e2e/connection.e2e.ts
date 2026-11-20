// obur needs a connection (docs/design.md, "Connection required"): one page says so when a page can't load, a save
// that fails says so and keeps what was typed, a save sent again counts once, nothing of a person's data is kept on
// the device, and entries an older version left waiting are sent once (one release only).
import { expect, test, type Page } from '@playwright/test';
import { e2eEnv } from '../../playwright.config.ts';
import { foodFingerprint } from '../../src/lib/shared/diary-rules.ts';
import type { FoodDetail } from '../../src/lib/shared/food-types.ts';
import { apiAs, createFood, openCaloriesOnly, signedInAs } from './fixtures.ts';

const isPhone = (page: Page) => (page.viewportSize()?.width ?? 1000) < 760;
const today = (page: Page) => page.evaluate(() => new Date().toLocaleDateString('en-CA'));
const heading = (page: Page, name: string) => page.getByRole('heading', { level: 1, name });

/** Today, with the service worker in charge, as on a phone that has used the app before. */
async function ready(page: Page) {
	await page.goto('/');
	await page.evaluate(() => navigator.serviceWorker.ready);
	await page.reload();
	await expect(heading(page, 'Today')).toBeVisible();
	await page.waitForFunction(() => navigator.serviceWorker.controller !== null);
}

/** Drops what the service worker prepared, so the next page change asks the server. */
async function forgetPrepared(page: Page) {
	await page.evaluate(() =>
		navigator.serviceWorker.controller?.postMessage({ type: 'obur:forget' })
	);
}

async function openQuickAdd(page: Page) {
	await page
		.getByRole('region', { name: 'Snacks' })
		.getByRole('button', { name: 'Add food to Snacks' })
		.click();
	await openCaloriesOnly(page);
	return page.getByRole('dialog', { name: 'Log calories only' });
}

test('the service worker and manifest are never served from a cache', async ({ request }) => {
	// A CDN in front (Cloudflare caches .js by default) would otherwise keep serving a stale service worker.
	for (const path of ['/service-worker.js', '/manifest.webmanifest']) {
		const response = await request.get(path);
		expect(response.ok()).toBe(true);
		expect(response.headers()['cache-control']).toBe('no-store');
	}
});

test('without a connection the app says it needs one, and Try again brings it back', async ({
	page,
	context
}) => {
	await signedInAs(page, 'Deniz');
	await ready(page);
	await context.setOffline(true);
	await page.reload();
	await expect(heading(page, 'obur needs a connection')).toBeVisible();
	await page.getByRole('button', { name: 'Try again' }).click();
	await expect(page.getByText('Still no connection. Try again in a moment.')).toBeVisible();

	// Back online: the page tries again by itself when the browser says so, or with a tap.
	await context.setOffline(false);
	await page
		.getByRole('button', { name: 'Try again' })
		.click({ timeout: 2000 })
		.catch(() => {});
	await expect(heading(page, 'Today')).toBeVisible();
});

test('the connection page follows the language chosen on the device', async ({ page, context }) => {
	await signedInAs(page, 'Ece');
	await ready(page);
	await context.addCookies([{ name: 'obur_lang', value: 'tr', url: e2eEnv.PUBLIC_ORIGIN }]);
	await context.setOffline(true);
	await page.reload();
	await expect(heading(page, 'obur için bağlantı gerekiyor')).toBeVisible();
	await expect(page.getByRole('button', { name: 'Tekrar dene' })).toBeVisible();
	await context.setOffline(false);
});

test('a page change without a connection shows the connection page, never another page', async ({
	page,
	context
}) => {
	await signedInAs(page, 'Zehra');
	await ready(page);
	await context.setOffline(true);
	await forgetPrepared(page);
	await page
		.getByRole('navigation', { name: 'Main' })
		.filter({ visible: true })
		.getByRole('link', { name: 'Journal' })
		.click();
	await expect(heading(page, 'obur needs a connection')).toBeVisible();
	await context.setOffline(false);
});

test('nothing of anyone’s data is kept in the browser’s storage', async ({ page }) => {
	await signedInAs(page, 'Kaan');
	await ready(page);
	for (const name of ['Log', 'Journal', 'Progress', 'More'])
		await page
			.getByRole('navigation', { name: 'Main' })
			.filter({ visible: true })
			.getByRole('link', { name })
			.click();
	await expect(heading(page, 'More')).toBeVisible();
	const caches = await page.evaluate(() => globalThis.caches.keys());
	expect(caches.length).toBeGreaterThan(0);
	expect(caches.every((k) => k.startsWith('obur-shell-'))).toBe(true);
});

test('a save without a connection says so, keeps what was typed, and saves when tapped again', async ({
	page,
	context
}) => {
	await signedInAs(page, 'Selin');
	await ready(page);
	const sheet = await openQuickAdd(page);
	await sheet.getByLabel('Calories (kcal)').fill('210');
	await sheet.getByLabel('What was it? (optional)').fill('Poğaça');
	await context.setOffline(true);
	await sheet.getByRole('button', { name: 'Save' }).click();
	await expect(sheet).toContainText("Couldn't save. Check your connection and try again.");
	await expect(sheet.getByLabel('Calories (kcal)')).toHaveValue('210');

	await context.setOffline(false);
	await sheet.getByRole('button', { name: 'Save' }).click();
	await expect(sheet).toBeHidden();
	if (isPhone(page)) await expect(heading(page, 'Today')).toBeVisible();
	await expect(page.getByRole('region', { name: 'Snacks' })).toContainText('Poğaça');
	const day = await apiAs<{ entries: unknown[] }>(
		page,
		'GET',
		`/api/v1/diary/${await today(page)}`
	);
	expect(day.entries).toHaveLength(1);
});

test('a save that arrived but lost its answer counts once when tapped again', async ({
	page,
	context
}, testInfo) => {
	// Only Chromium lets a test hold back the service worker's own requests.
	test.skip(testInfo.project.name !== 'desktop-chromium', 'needs Chromium request routing');
	await signedInAs(page, 'Arda');
	await ready(page);
	let lost = false;
	await context.route('**/api/v1/diary/entries', async (route) => {
		if (lost || route.request().method() !== 'POST') return route.continue();
		lost = true;
		// The server saves it; the answer never reaches the app.
		await route.fetch();
		await route.abort('connectionreset');
	});
	const sheet = await openQuickAdd(page);
	await sheet.getByLabel('Calories (kcal)').fill('95');
	await sheet.getByLabel('What was it? (optional)').fill('Mandalina');
	await sheet.getByRole('button', { name: 'Save' }).click();
	await expect(sheet).toContainText("Couldn't save. Check your connection and try again.");
	await sheet.getByRole('button', { name: 'Save' }).click();
	await expect(sheet).toBeHidden();
	const day = await apiAs<{ entries: { description: string }[] }>(
		page,
		'GET',
		`/api/v1/diary/${await today(page)}`
	);
	expect(day.entries.map((e) => e.description)).toEqual(['Mandalina']);
	await context.unroute('**/api/v1/diary/entries');
});

test('a day note that can’t be saved says so and goes with the next change', async ({
	page,
	context
}) => {
	await signedInAs(page, 'Nil');
	await ready(page);
	const card = page.getByRole('region', { name: 'Notes' });
	await card.getByRole('button', { name: /^Notes/ }).click();
	const field = card.getByLabel('Note for this day');
	await context.setOffline(true);
	await field.fill('Walked to work');
	await expect(card.getByText('Not saved · it goes with your next change')).toBeVisible();
	await context.setOffline(false);
	const saved = page.waitForResponse((r) => /\/note$/.test(r.url()) && r.ok());
	await field.press('End');
	await field.pressSequentially(' and back');
	await saved;
	await expect(card.getByText(/^Saved .* only you see your notes$/)).toBeVisible();
	await page.reload();
	await expect(card).toContainText('Walked to work and back');
});

test('a tab left open never saves into the account of someone who signed in since', async ({
	page
}) => {
	await signedInAs(page, 'Ayşe');
	await ready(page);
	const sheet = await openQuickAdd(page);
	await sheet.getByLabel('Calories (kcal)').fill('300');
	await sheet.getByLabel('What was it? (optional)').fill('Simit');
	// Someone else signs in on this browser (in another tab: the session cookie is the browser's, not the tab's).
	await signedInAs(page, 'Mehmet');
	const reloaded = page.waitForEvent('load');
	await sheet.getByRole('button', { name: 'Save' }).click();
	// The server refuses an entry meant for Ayşe, and the tab reloads as the person now signed in.
	await reloaded;
	await page.goto('/');
	await expect(heading(page, 'Today')).toBeVisible();
	const day = await apiAs<{ entries: unknown[] }>(
		page,
		'GET',
		`/api/v1/diary/${await today(page)}`
	);
	expect(day.entries).toEqual([]);
});

/** Puts entries in this account's queue as versions before 2026-11-20 kept it. */
async function oldQueue(page: Page, ownerId: string, items: Record<string, unknown>[]) {
	await page.evaluate(
		({ ownerId, items }) =>
			new Promise<void>((resolve, reject) => {
				const open = indexedDB.open(`obur-queue-${ownerId}`, 1);
				open.onupgradeneeded = () =>
					open.result.createObjectStore('ops', { keyPath: 'seq', autoIncrement: true });
				open.onsuccess = () => {
					const tx = open.result.transaction('ops', 'readwrite');
					for (const item of items) tx.objectStore('ops').add(item);
					tx.oncomplete = () => {
						open.result.close();
						resolve();
					};
					tx.onerror = () => reject(tx.error);
				};
			}),
		{ ownerId, items }
	);
}

test('entries an older version left waiting are sent at the start; a refused one waits on Today', async ({
	page
}) => {
	const ownerId = await signedInAs(page, 'Ozan');
	await ready(page);
	const date = await today(page);
	const queued = (id: string, body: Record<string, unknown>, name: string, kcal: number) => ({
		id,
		ownerId,
		path: '/api/v1/diary/entries',
		body: { id, date, meal: 'snacks', zone: 'UTC', ...body },
		preview: { kind: 'diary', localDate: date, meal: 'snacks', name, quantity: '1', kcal },
		createdAt: new Date().toISOString(),
		attempts: 0,
		status: 'pending'
	});
	await oldQueue(page, ownerId, [
		queued(crypto.randomUUID(), { kind: 'quick', kcal: 150, description: 'Ayran' }, 'Ayran', 150),
		queued(
			crypto.randomUUID(),
			{
				kind: 'food',
				foodId: crypto.randomUUID(),
				amount: 100,
				unit: { kind: 'mass', unit: 'g' }
			},
			'Lost food',
			80
		)
	]);
	await page.reload();
	await expect(page.getByRole('region', { name: 'Snacks' })).toContainText('Ayran');
	const card = page.getByRole('button', { name: /1 entry couldn't be saved/ });
	await expect(card).toBeVisible();
	await card.click();
	await page.getByRole('dialog').getByRole('button', { name: 'Discard this entry' }).click();
	await expect(card).toBeHidden();
	await expect
		.poll(() =>
			page.evaluate(
				async (name) => (await indexedDB.databases()).some((d) => d.name === name),
				`obur-queue-${ownerId}`
			)
		)
		.toBe(false);
	const day = await apiAs<{ entries: { description: string }[] }>(
		page,
		'GET',
		`/api/v1/diary/${date}`
	);
	expect(day.entries.map((e) => e.description)).toEqual(['Ayran']);
});

test('a save that landed but whose answer was lost is acknowledged when sent again, even after the food changed', async ({
	page
}, testInfo) => {
	// 2026-11-20 audit: the retry was refused as "food changed".
	await signedInAs(page, 'Ayşe');
	const food = {
		name: `Barley soup ${testInfo.project.name}`,
		basis: '100g',
		nutrients: [{ code: 'energy_kcal', value: 100, qualifier: 'reported' }]
	};
	const foodId = await createFood(page, food);
	const detail = await apiAs<FoodDetail>(page, 'GET', `/api/v1/foods/${foodId}`);
	const date = await today(page);
	const entry = {
		id: crypto.randomUUID(),
		kind: 'food',
		foodId,
		amount: 100,
		unit: { kind: 'mass', unit: 'g' },
		date,
		meal: 'lunch',
		zone: 'UTC',
		expected: foodFingerprint(detail)
	};
	const first = await apiAs<{ id: string }>(page, 'POST', '/api/v1/diary/entries', entry);
	await apiAs(page, 'PUT', `/api/v1/foods/${foodId}`, {
		version: detail.version,
		food: {
			...food,
			brand: null,
			servings: [],
			nutrients: [{ code: 'energy_kcal', value: 250, qualifier: 'reported' }]
		}
	});
	expect(await apiAs(page, 'POST', '/api/v1/diary/entries', entry)).toEqual(first);
	// A new entry with the old values is still refused.
	const fresh = await page.request.post('/api/v1/diary/entries', {
		data: { ...entry, id: crypto.randomUUID() },
		headers: { origin: e2eEnv.PUBLIC_ORIGIN }
	});
	expect(fresh.status()).toBe(409);
	const day = await apiAs<{ entries: unknown[] }>(page, 'GET', `/api/v1/diary/${date}`);
	expect(day.entries).toHaveLength(1);
});

test('a food changed on another device while its amount sheet is open is shown again, not logged', async ({
	page
}, testInfo) => {
	const tag = testInfo.project.name;
	await signedInAs(page, 'Ayşe');
	const name = `Oat milk ${tag}`;
	const food = {
		name,
		basis: '100ml',
		nutrients: [{ code: 'energy_kcal', value: 45, qualifier: 'reported' }]
	};
	const foodId = await createFood(page, food);
	await page.goto('/log?meal=breakfast');
	await page.getByRole('searchbox').fill(name);
	await page.getByRole('button', { name: new RegExp(name) }).click();
	const sheet = page.getByRole('dialog');
	await expect(sheet.getByText('45 kcal per 100 ml')).toBeVisible();
	await apiAs(page, 'PUT', `/api/v1/foods/${foodId}`, {
		version: 1,
		food: {
			...food,
			brand: null,
			servings: [],
			nutrients: [{ code: 'energy_kcal', value: 60, qualifier: 'reported' }]
		}
	});
	await sheet.getByRole('button', { name: /^Log to/ }).click();
	await expect(sheet).toContainText('This food was just changed on another device.');
	await expect(sheet.getByText('60 kcal per 100 ml')).toBeVisible();
	// Saving again, now with what is shown, logs it.
	await sheet.getByRole('button', { name: /^Log to/ }).click();
	await expect(sheet).toBeHidden();
});

test('an Undo that cannot reach the server says so instead of looking done', async ({
	page,
	context
}) => {
	await signedInAs(page, 'Zeynep');
	await page.goto('/');
	const snacks = page.getByRole('region', { name: 'Snacks' });
	const sheet = await openQuickAdd(page);
	await sheet.getByLabel('Calories (kcal)').fill('120');
	await sheet.getByLabel('What was it? (optional)').fill('Apple');
	await sheet.getByRole('button', { name: 'Save' }).click();
	if (isPhone(page)) await expect(heading(page, 'Today')).toBeVisible();
	await snacks.getByRole('button', { name: /Apple/ }).click();
	await page.getByRole('dialog').getByRole('button', { name: 'Delete' }).click();
	await expect(snacks.getByRole('button', { name: /Apple/ })).toHaveCount(0);

	await context.setOffline(true);
	await page.getByRole('status').getByRole('button', { name: 'Undo' }).click();
	await expect(page.getByRole('status').filter({ hasText: "Couldn't undo" })).toBeVisible();
	await expect(snacks.getByRole('button', { name: /Apple/ })).toHaveCount(0);
	await context.setOffline(false);
});

test('signing out without a connection says it needs one and keeps the person signed in', async ({
	page,
	context
}) => {
	await signedInAs(page, 'Zeynep');
	await ready(page);
	await page.goto('/more');
	await page.waitForLoadState('networkidle');
	await context.setOffline(true);
	await page.getByRole('button', { name: 'Sign out' }).click();
	await expect(
		page.getByRole('status').filter({ hasText: 'Signing out needs a connection' })
	).toBeVisible({ timeout: 10_000 });
	await expect(page).toHaveURL(/\/more$/);
	await context.setOffline(false);
	await page.reload();
	await expect(page.getByText('Signed in as Zeynep')).toBeVisible();
});
