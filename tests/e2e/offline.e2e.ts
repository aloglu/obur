// The bounded offline scope (docs/design.md): queued new entries with ordered, retry-safe sending, visible pending
// state, cached viewing, and sign-out that never silently drops unsent entries.
import { expect, test, type Page } from '@playwright/test';
import { apiAs, signedInAs, openCaloriesOnly } from './fixtures.ts';

const isPhone = (page: Page) => (page.viewportSize()?.width ?? 1000) < 760;

/**
 * Opens only Today online, the way people do. The service worker takes control and the app saves a copy of every
 * main tab in the background, so tabs never visited online still open offline (owner's iPhone, Phase 1).
 */
async function primeCache(page: Page) {
	await page.goto('/');
	await page.evaluate(() => navigator.serviceWorker.ready);
	await page.reload();
	await expect(page.getByRole('heading', { level: 1, name: 'Today' })).toBeVisible();
	await expect
		.poll(() =>
			page.evaluate(async () => {
				const keys = await (await caches.open('obur-data-v1')).keys();
				const paths = keys.map((r) => new URL(r.url).pathname);
				return ['/__data.json', '/log', '/progress/__data.json'].every((p) => paths.includes(p));
			})
		)
		.toBe(true);
}

async function quickAdd(page: Page, kcal: string, description: string) {
	await page
		.getByRole('region', { name: 'Snacks' })
		.getByRole('button', { name: 'Add to Snacks' })
		.click();
	await openCaloriesOnly(page);
	const sheet = page.getByRole('dialog', { name: 'Log calories only' });
	await sheet.getByLabel('Calories (kcal)').fill(kcal);
	await sheet.getByLabel('What was it? (optional)').fill(description);
	await sheet.getByRole('button', { name: 'Save' }).click();
	await expect(page.getByRole('status')).toContainText('Saved on this device');
	if (isPhone(page))
		await expect(page.getByRole('heading', { level: 1, name: 'Today' })).toBeVisible();
}

test('entries made offline wait visibly, then arrive once and in order', async ({
	page,
	context
}) => {
	await signedInAs(page, 'Ayşe');
	await primeCache(page);
	await context.setOffline(true);

	await page
		.getByRole('region', { name: 'Water' })
		.getByRole('button', { name: 'Add 250 ml of water' })
		.click();
	await expect(page.getByRole('region', { name: 'Water' })).toContainText(
		'+250 ml waiting to sync'
	);

	await quickAdd(page, '300', 'Simit');
	await quickAdd(page, '50', 'Çay');
	const snacks = page.getByRole('region', { name: 'Snacks' });
	await expect(snacks.getByText('Waiting to sync')).toHaveCount(2);

	// Back online: everything is sent in the order it was created, exactly once.
	await context.setOffline(false);
	await page.evaluate(() => dispatchEvent(new Event('online')));
	await expect(snacks.getByText('Waiting to sync')).toHaveCount(0);
	// One reconnect is enough: the sent entries appear as saved at once, and the saved-copy note goes (owner's iPhone
	// check, 2026-10-30: they vanished until the next navigation, because the refresh met the saved copy).
	await expect(snacks).toContainText('Simit');
	await expect(page.getByText('Showing the copy saved on this device')).toHaveCount(0);
	await expect(snacks).toContainText('Çay');
	await expect(page.getByRole('region', { name: 'Water' })).toContainText('250 ml');

	const date = await page.evaluate(() => new Date().toLocaleDateString('en-CA'));
	const day = await apiAs<{ entries: { description: string }[] }>(
		page,
		'GET',
		`/api/v1/diary/${date}`
	);
	expect(day.entries.map((e) => e.description)).toEqual(['Simit', 'Çay']);

	// Cached viewing: the day still opens without a connection, once the saved copy has caught up.
	await expect
		.poll(() =>
			page.evaluate(async () => {
				const hit = await (await caches.open('obur-data-v1')).match(location.origin + '/');
				return hit ? hit.text() : '';
			})
		)
		.toContain('Simit');
	await context.setOffline(true);
	await page.reload();
	await expect(page.getByRole('heading', { level: 1, name: 'Today' })).toBeVisible();
	await expect(snacks).toContainText('Simit');
	await context.setOffline(false);
});

test('signing out asks before discarding entries that have not been sent', async ({
	page,
	context,
	browserName
}) => {
	await signedInAs(page, 'Mehmet');
	await primeCache(page);
	await context.setOffline(true);
	await quickAdd(page, '120', 'Elma');
	const nav = page.getByRole('navigation', { name: 'Main' }).filter({ visible: true });
	await nav.getByRole('link', { name: 'More' }).click();

	// Sign-out tries to send first, then asks; declining keeps everything.
	let dialog = page.waitForEvent('dialog');
	await page.getByRole('button', { name: 'Sign out' }).click();
	expect((await dialog).message()).toContain("haven't been sent");
	await (await dialog).dismiss();
	await expect(page).toHaveURL(/\/(settings|more)$/);

	// Signing out needs the server; keep this entry failing so it is still unsent when confirmed. Playwright cannot
	// intercept requests from a service-worker-controlled page in WebKit, so this half runs in Chromium only.
	test.skip(
		browserName === 'webkit',
		'request interception does not apply under a service worker in WebKit'
	);
	await context.route('**/api/v1/diary/entries', (route) => route.abort());
	await context.setOffline(false);
	dialog = page.waitForEvent('dialog');
	await page.getByRole('button', { name: 'Sign out' }).click();
	await (await dialog).accept();
	await expect(page).toHaveURL(/\/login$/);
	const queues = await page.evaluate(async () => (await indexedDB.databases()).map((d) => d.name));
	expect(queues.filter((n) => n?.startsWith('obur-queue-'))).toEqual([]);
});

test('the Log tab opens offline without a visit online, and a quick add there confirms once', async ({
	page,
	context
}) => {
	await signedInAs(page, 'Emre');
	await primeCache(page);
	await context.setOffline(true);
	const nav = page.getByRole('navigation', { name: 'Main' }).filter({ visible: true });
	await nav.getByRole('link', { name: 'Log' }).click();
	await expect(page.getByRole('heading', { level: 1, name: 'Log' })).toBeVisible();

	await openCaloriesOnly(page);
	const sheet = page.getByRole('dialog', { name: 'Log calories only' });
	await sheet.getByLabel('Calories (kcal)').fill('250');
	await sheet.getByLabel('What was it? (optional)').fill('Tost');
	await sheet.getByRole('button', { name: 'Save' }).click();
	// The sheet closes, so the confirmation is visible rather than hidden behind it.
	await expect(sheet).toHaveCount(0);
	await expect(page.getByRole('status')).toContainText('Saved on this device');
	await expect(page.getByRole('heading', { level: 1, name: 'Today' })).toBeVisible();
	await expect(page.getByText('Waiting to sync')).toHaveCount(1);
	await context.setOffline(false);
});

test('a connection that hangs gives up quickly, and the next entry is kept at once', async ({
	page,
	context,
	browserName
}) => {
	test.skip(
		browserName === 'webkit',
		'request interception does not apply under a service worker in WebKit'
	);
	await signedInAs(page, 'Ece');
	await primeCache(page);
	// Like Airplane Mode on iOS: requests neither succeed nor fail.
	await context.route('**/api/v1/body/water', () => {});
	const water = page.getByRole('region', { name: 'Water' });
	let started = Date.now();
	await water.getByRole('button', { name: 'Add 250 ml of water' }).click();
	await expect(water).toContainText('+250 ml waiting to sync', { timeout: 6000 });
	expect(Date.now() - started).toBeLessThan(5000);
	started = Date.now();
	await water.getByRole('button', { name: 'Add 250 ml of water' }).click();
	await expect(water).toContainText('+500 ml waiting to sync');
	expect(Date.now() - started).toBeLessThan(1500);
	await context.unrouteAll({ behavior: 'ignoreErrors' });
});

test('the service worker and manifest are never served from a cache', async ({ request }) => {
	// A CDN in front (Cloudflare caches .js by default) would otherwise keep serving a stale service worker that
	// cannot install, leaving the app without offline support.
	for (const path of ['/service-worker.js', '/manifest.webmanifest']) {
		const response = await request.get(path);
		expect(response.ok()).toBe(true);
		expect(response.headers()['cache-control']).toBe('no-store');
	}
});

test('with a hanging connection, only the first page waits; later tabs open from the saved copy at once', async ({
	page,
	context,
	browserName
}) => {
	test.skip(
		browserName === 'webkit',
		'request interception does not apply under a service worker in WebKit'
	);
	await signedInAs(page, 'Deniz');
	await primeCache(page);
	// Page data requests neither succeed nor fail, as on iOS in Airplane Mode.
	await context.route('**/__data.json*', () => {});
	const nav = page.getByRole('navigation', { name: 'Main' }).filter({ visible: true });
	await nav.getByRole('link', { name: 'Progress' }).click();
	await expect(page.getByRole('heading', { level: 1, name: 'Progress' })).toBeVisible({
		timeout: 6000
	});
	const started = Date.now();
	await nav.getByRole('link', { name: 'Today' }).click();
	await expect(page.getByRole('heading', { level: 1, name: 'Today' })).toBeVisible();
	expect(Date.now() - started).toBeLessThan(1500);
	await context.unrouteAll({ behavior: 'ignoreErrors' });
});

test('offline, the app stays on the page it is on, says what it cannot do, and never swaps in another page', async ({
	page,
	context
}) => {
	await signedInAs(page, 'Zehra');
	await primeCache(page);
	await context.setOffline(true);
	// The phone's + buttons open the Log with a meal in the address, which was never visited online.
	await page.goto('/log?meal=snacks&date=2026-10-29');
	await expect(page.getByRole('heading', { level: 1, name: 'Log' })).toBeVisible();
	// Reconnection attempts and returning to the foreground while still offline must not reload the page.
	await page.evaluate(() => {
		dispatchEvent(new Event('online'));
		document.dispatchEvent(new Event('visibilitychange'));
	});
	await page.getByLabel('Search foods').fill('mercimek');
	await expect(page.getByText('Search needs a connection')).toBeVisible();
	await expect(page.getByRole('heading', { level: 1, name: 'Log' })).toBeVisible();

	// A page never saved on this device says so instead of showing Today.
	await page.goto('/foods/new');
	await expect(
		page.getByRole('heading', { level: 1, name: 'Not available offline' })
	).toBeVisible();
	await context.setOffline(false);
});

test('a note typed offline waits on the device and arrives when the server is back', async ({
	page,
	context
}) => {
	await signedInAs(page, 'Notlu');
	await primeCache(page);
	await context.setOffline(true);

	const note = page.getByRole('region', { name: 'Notes' });
	await note.getByRole('button', { name: /^Notes/ }).click();
	await note.getByLabel('Note for this day').fill('typed on the train');
	await expect(note).toContainText('Saved on this device', { timeout: 15_000 });

	await context.setOffline(false);
	await page.evaluate(() => dispatchEvent(new Event('online')));
	await expect(note).toContainText(/Saved \S+.*only you see your notes/, { timeout: 15_000 });
	await page.reload();
	await expect(note).toContainText('typed on the train');
});
