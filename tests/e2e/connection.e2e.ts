// obur needs a connection (docs/design.md, "Connection required"): one page says so when a page can't load, a save
// that fails says so and keeps what was typed, a save sent again counts once, nothing of a person's data is kept on
// the device, and entries an older version left waiting are sent once (one release only).
import { expect, test, type Page } from '@playwright/test';
import { e2eEnv } from '../../playwright.config.ts';
import { foodFingerprint } from '../../src/lib/shared/diary-rules.ts';
import type { FoodDetail } from '../../src/lib/shared/food-types.ts';
import {
	apiAs,
	choose,
	createFood,
	losingToward,
	notesOf,
	openCaloriesOnly,
	rowCount,
	signedInAs
} from './fixtures.ts';

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

test('pages and API answers are never cached; code files are', async ({ page }) => {
	await signedInAs(page, 'Kaan');
	for (const path of [
		'/',
		'/progress',
		'/api/v1/profile',
		'/__data.json?x-sveltekit-invalidated=01'
	]) {
		const response = await page.request.get(path);
		expect(response.headers()['cache-control'], path).toContain('no-store');
		expect(response.headers()['cache-control'], path).toContain('private');
	}
	const html = await (await page.request.get('/')).text();
	const code = html.match(/\/_app\/immutable\/[^"']+\.js/)?.[0];
	expect(code).toBeTruthy();
	expect((await page.request.get(code!)).headers()['cache-control']).toContain('immutable');
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

/** The server saves the first POST to `url`, but its answer never reaches the app. */
async function loseFirstAnswer(page: Page, url: string, method = 'POST') {
	let lost = false;
	await page.context().route(url, async (route) => {
		if (lost || route.request().method() !== method) return route.continue();
		lost = true;
		await route.fetch();
		await route.abort('connectionreset');
	});
}

test.describe('a save whose answer was lost counts once when tapped again (2026-11-25 audit)', () => {
	test.skip(({ browserName }) => browserName !== 'chromium', 'needs Chromium request routing');

	test('water, and a later glass of the same size is a new one', async ({ page }) => {
		const userId = await signedInAs(page, 'Arda');
		await ready(page);
		await loseFirstAnswer(page, '**/api/v1/body/water');
		const water = page.getByRole('region', { name: 'Water' });
		const add = water.getByRole('button', { name: 'Add 250 ml of water' });
		await add.click();
		await expect(page.getByRole('status')).toContainText("Couldn't save");
		await add.click();
		await expect(water).toContainText('250 ml');
		expect(await rowCount('water_entries', userId)).toBe(1);
		await add.click();
		await expect(water).toContainText('500 ml');
		expect(await rowCount('water_entries', userId)).toBe(2);
	});

	test('a weigh-in', async ({ page }) => {
		const userId = await signedInAs(page, 'Arda');
		await ready(page);
		await loseFirstAnswer(page, '**/api/v1/body/weight');
		const weight = page.getByRole('region', { name: 'Weight' });
		await weight.getByRole('button', { name: 'New weigh-in' }).click();
		await weight.getByLabel('New weight').fill('82.4');
		await weight.getByRole('button', { name: 'Save' }).click();
		await expect(page.getByRole('status')).toContainText("Couldn't save");
		await weight.getByRole('button', { name: 'Save' }).click();
		await expect(weight).toContainText('82.4 kg');
		expect(await rowCount('weight_entries', userId)).toBe(1);
	});

	test('an activity', async ({ page }) => {
		const userId = await signedInAs(page, 'Arda');
		await losingToward(userId, 70);
		await ready(page);
		await loseFirstAnswer(page, '**/api/v1/body/activity');
		await page
			.getByRole('region', { name: 'Budget' })
			.getByRole('button', { name: 'Add activity' })
			.click();
		const sheet = page.getByRole('dialog', { name: 'Activity' });
		await sheet.getByLabel('Calories burned (kcal)').fill('300');
		await sheet.getByRole('button', { name: 'Add to budget' }).click();
		await expect(sheet.getByRole('alert')).toBeVisible();
		await sheet.getByRole('button', { name: 'Add to budget' }).click();
		await expect(sheet).toBeHidden();
		expect(await rowCount('activity_entries', userId)).toBe(1);
	});

	test('a copied meal', async ({ page }) => {
		const userId = await signedInAs(page, 'Arda');
		await apiAs(page, 'POST', '/api/v1/diary/entries', {
			kind: 'quick',
			date: await today(page),
			meal: 'dinner',
			zone: 'UTC',
			kcal: 180,
			description: 'Ayran'
		});
		await ready(page);
		await loseFirstAnswer(page, '**/api/v1/diary/entries/bulk');
		const dinner = page.getByRole('region', { name: 'Dinner' });
		await dinner.getByRole('button', { name: 'Dinner actions' }).click();
		await page.getByRole('menuitem', { name: 'Copy meal to…' }).click();
		const sheet = page.getByRole('dialog', { name: 'Copy 1 entry' });
		await choose(sheet, 'Meal', 'Snacks');
		await sheet.getByRole('button', { name: 'Copy to Snacks' }).click();
		await expect(page.getByRole('status')).toContainText('changed on another device');
		await sheet.getByRole('button', { name: 'Copy to Snacks' }).click();
		await expect(page.getByRole('status')).toContainText('Copied 1 entry');
		expect(await rowCount('diary_entries', userId)).toBe(2);
	});
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

test('a tab whose data refreshes with someone else signed in starts again, without the earlier person’s draft', async ({
	page,
	context
}, testInfo) => {
	test.skip(testInfo.project.name !== 'desktop-chromium', 'needs Chromium request routing');
	const ayten = await signedInAs(page, 'Ayten');
	await ready(page);
	const card = page.getByRole('region', { name: 'Notes' });
	await card.getByRole('button', { name: /^Notes/ }).click();
	// A draft the server could not save yet stays on the card (refused, not offline: being offline would hold
	// back the refresh below for a minute).
	await context.route('**/note', (route) =>
		route.fulfill({ status: 503, contentType: 'application/json', body: '{"error":"busy"}' })
	);
	await card.getByLabel('Note for this day').fill('Ayten’s own note');
	await expect(card.getByText('Not saved · it goes with your next change')).toBeVisible();
	await context.unroute('**/note');
	// Someone else signs in on this browser; coming back to this tab refreshes the account's data (A01).
	const murat = await signedInAs(page, 'Murat');
	const reloaded = page.waitForEvent('load');
	await page.evaluate(() => document.dispatchEvent(new Event('visibilitychange')));
	await reloaded;
	await expect(heading(page, 'Today')).toBeVisible();
	await expect(page.getByText('Ayten’s own note')).toHaveCount(0);
	// Saved for nobody: not for Murat, and not for Ayten, who is no longer signed in here.
	expect(await notesOf(murat)).toEqual([]);
	expect(await notesOf(ayten)).toEqual([]);
});

test('a note sent again later keeps the time it was typed, so a newer one from another device stays', async ({
	page,
	context
}, testInfo) => {
	test.skip(testInfo.project.name !== 'desktop-chromium', 'needs Chromium request routing');
	await signedInAs(page, 'Ece');
	await ready(page);
	const card = page.getByRole('region', { name: 'Notes' });
	await card.getByRole('button', { name: /^Notes/ }).click();
	await context.route('**/note', (route) =>
		route.fulfill({ status: 503, contentType: 'application/json', body: '{"error":"busy"}' })
	);
	await card.getByLabel('Note for this day').fill('Typed first');
	await expect(card.getByText('Not saved · it goes with your next change')).toBeVisible();
	await context.unroute('**/note');
	// Later, on the phone (A22).
	await apiAs(page, 'POST', `/api/v1/diary/days/${await today(page)}/note`, {
		id: crypto.randomUUID(),
		text: 'Typed later on the phone',
		typedAt: new Date().toISOString()
	});
	// Closing the card sends the waiting words again, with the time they were typed.
	const sent = page.waitForResponse((r) => /\/note$/.test(r.url()) && r.ok());
	await card.getByRole('button', { name: /^Notes/ }).click();
	await sent;
	await page.reload();
	await expect(card).toContainText('Typed later on the phone');
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

test.describe('a save whose answer was lost, then changed, saves the change (2026-11-25 Review.md audit, 2.7)', () => {
	test.skip(({ browserName }) => browserName !== 'chromium', 'needs Chromium request routing');

	test('a typed entry', async ({ page }) => {
		await signedInAs(page, 'Deniz');
		await page.goto('/log');
		await loseFirstAnswer(page, '**/api/v1/diary/entries');
		await page.getByRole('button', { name: 'Type it' }).click();
		const sheet = page.getByRole('dialog', { name: 'Type what you ate' });
		await sheet.getByLabel('You typed').fill('120 kcal snack');
		const kcal = sheet.getByRole('region', { name: 'Calories only' }).getByLabel('Calories (kcal)');
		await expect(kcal).toHaveValue('120');
		await sheet.getByRole('button', { name: /^Log / }).click();
		await expect(sheet.getByText('Some items could not be saved.')).toBeVisible();
		await sheet.getByRole('button', { name: 'Edit Calories only' }).click();
		await kcal.fill('150');
		await sheet.getByRole('button', { name: /^Log / }).click();
		await expect(sheet).toBeHidden();
		await expect(page.getByText(/^Logged/)).toBeVisible();
	});

	test('a saved meal logged to another meal', async ({ page }) => {
		await signedInAs(page, 'Deniz');
		const day = await today(page);
		const { id } = await apiAs<{ id: string }>(page, 'POST', '/api/v1/diary/entries', {
			kind: 'quick',
			date: day,
			meal: 'breakfast',
			zone: 'UTC',
			kcal: 90,
			description: 'Toast'
		});
		await apiAs(page, 'POST', '/api/v1/saved-meals', {
			id: crypto.randomUUID(),
			name: 'Toast plate',
			entryIds: [id]
		});
		await page.goto('/log');
		await loseFirstAnswer(page, '**/api/v1/saved-meals/*/log');
		await page.getByRole('searchbox').fill('toast plate');
		await page.getByRole('button', { name: /Toast plate/ }).click();
		const sheet = page.getByRole('dialog', { name: 'Toast plate' });
		await choose(sheet, 'Meal', 'Lunch');
		await sheet.getByRole('button', { name: /^Log 1 item/ }).click();
		await expect(sheet.getByRole('alert')).toBeVisible();
		await choose(sheet, 'Meal', 'Dinner');
		await sheet.getByRole('button', { name: /^Log 1 item/ }).click();
		await expect(sheet).toBeHidden();
		await expect(page.getByText('Logged 1 item')).toBeVisible();
	});

	test('a meal saved as a meal, renamed', async ({ page }) => {
		await signedInAs(page, 'Deniz');
		await apiAs(page, 'POST', '/api/v1/diary/entries', {
			kind: 'quick',
			date: await today(page),
			meal: 'breakfast',
			zone: 'UTC',
			kcal: 90,
			description: 'Toast'
		});
		await page.goto('/');
		await loseFirstAnswer(page, '**/api/v1/saved-meals');
		const breakfast = page.getByRole('region', { name: 'Breakfast' });
		await breakfast.getByRole('button', { name: 'Breakfast actions' }).click();
		await breakfast.getByRole('menuitem', { name: 'Save Breakfast as a meal' }).click();
		const sheet = page.getByRole('dialog', { name: 'Save as a meal' });
		await sheet.getByLabel('Name').fill('Morning toast');
		await sheet.getByRole('button', { name: 'Save meal' }).click();
		await expect(sheet.getByRole('alert')).toBeVisible();
		await sheet.getByLabel('Name').fill('Weekday toast');
		await sheet.getByRole('button', { name: 'Save meal' }).click();
		await expect(sheet).toBeHidden();
		await expect(page.getByText('Saved “Weekday toast”')).toBeVisible();
	});

	test('a new recipe', async ({ page }) => {
		await signedInAs(page, 'Deniz');
		const name = 'Lost reply lentils';
		await createFood(page, {
			name,
			basis: '100g',
			nutrients: [{ code: 'energy_kcal', value: 340, qualifier: 'reported' }]
		});
		await page.goto('/recipes/new');
		await loseFirstAnswer(page, '**/api/v1/recipes/*', 'PUT');
		await page.getByLabel('Name').fill('Lentil stew');
		await page.getByLabel('Servings it makes').fill('4');
		await page.getByRole('button', { name: 'Add food' }).click();
		const add = page.getByRole('dialog', { name: 'Add a food' });
		await add.getByLabel('Search foods').fill(name);
		await add.getByRole('button', { name: new RegExp(name) }).click();
		const amount = page.getByRole('dialog', { name: new RegExp(name) });
		await amount.getByLabel('Amount').fill('200');
		await amount.getByRole('button', { name: 'Add to meal' }).click();
		await page.getByRole('button', { name: 'Save', exact: true }).click();
		await expect(page.getByRole('alert')).toBeVisible();
		await page.getByLabel('Servings it makes').fill('5');
		await page.getByRole('button', { name: 'Save', exact: true }).click();
		await expect(page).toHaveURL(/\/recipes$/);
		// One recipe, with the change: not the lost save's copy without it.
		const stew = page.getByRole('main').getByRole('link', { name: /Lentil stew/ });
		await expect(stew).toHaveCount(1);
		await expect(stew).toContainText('5 servings');
	});
	test('a new saved meal in its editor', async ({ page }) => {
		await signedInAs(page, 'Deniz');
		const name = 'Lost reply oats';
		await createFood(page, {
			name,
			basis: '100g',
			nutrients: [{ code: 'energy_kcal', value: 380, qualifier: 'reported' }]
		});
		await page.goto('/saved-meals/new');
		await loseFirstAnswer(page, '**/api/v1/saved-meals/*', 'PUT');
		await page.getByLabel('Name').fill('Oat bowl');
		await page.getByRole('button', { name: 'Add food' }).click();
		const add = page.getByRole('dialog', { name: 'Add a food' });
		await add.getByLabel('Search foods').fill(name);
		await add.getByRole('button', { name: new RegExp(name) }).click();
		const amount = page.getByRole('dialog', { name: new RegExp(name) });
		await amount.getByLabel('Amount').fill('50');
		await amount.getByRole('button', { name: 'Add to meal' }).click();
		await page.getByRole('button', { name: 'Save', exact: true }).click();
		await expect(page.getByRole('alert')).toBeVisible();
		await page.getByLabel('Name').fill('Big oat bowl');
		await page.getByRole('button', { name: 'Save', exact: true }).click();
		await expect(page).toHaveURL(/\/saved-meals$/);
		const meals = page.getByRole('main').getByRole('link', { name: /oat bowl/i });
		await expect(meals).toHaveCount(1);
		await expect(meals).toContainText('Big oat bowl');
	});
});
