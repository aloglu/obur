// The bounded offline scope (docs/design.md): queued new entries with ordered, retry-safe sending, visible pending
// state, cached viewing, and sign-out that never silently drops unsent entries.
import { expect, test, type Page } from '@playwright/test';
import { e2eEnv } from '../../playwright.config.ts';
import { foodFingerprint } from '../../src/lib/shared/diary-rules.ts';
import type { FoodDetail } from '../../src/lib/shared/food-types.ts';
import { apiAs, createFood, signedInAgain, signedInAs, openCaloriesOnly } from './fixtures.ts';

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
				const keys = await (await caches.open('obur-data-v2')).keys();
				const paths = keys.map((r) => new URL(r.url).pathname);
				return ['/__data.json', '/log', '/progress/__data.json'].every((p) => paths.includes(p));
			})
		)
		.toBe(true);
}

async function quickAdd(page: Page, kcal: string, description: string) {
	await page
		.getByRole('region', { name: 'Snacks' })
		.getByRole('button', { name: 'Add food to Snacks' })
		.click();
	await openCaloriesOnly(page);
	const sheet = page.getByRole('dialog', { name: 'Log calories only' });
	await sheet.getByLabel('Calories (kcal)').fill(kcal);
	await sheet.getByLabel('What was it? (optional)').fill(description);
	await sheet.getByRole('button', { name: 'Save' }).click();
	await expect(page.getByRole('status').filter({ hasText: 'Saved on this device' })).toBeVisible();
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
	// The warning card says so, and how many went.
	const back = page.getByRole('status').filter({ hasText: /Back online/ });
	await expect(back).toContainText('3 waiting entries were sent.');
	// One reconnect is enough: the sent entries appear as saved at once, and the saved-copy note goes (owner's iPhone
	// check, 2026-10-30: they vanished until the next navigation, because the refresh met the saved copy).
	await expect(snacks).toContainText('Simit');
	await expect(page.getByText("You're offline")).toHaveCount(0);
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
				const hit = await (await caches.open('obur-data-v2')).match(location.origin + '/');
				return hit ? hit.text() : '';
			})
		)
		.toContain('Simit');
	await context.setOffline(true);
	await page.reload();
	await expect(page.getByRole('heading', { level: 1, name: 'Today' })).toBeVisible();
	await expect(snacks).toContainText('Simit');
	// Offline, a grey card says what is shown and what happens to new entries.
	await expect(page.getByRole('status').filter({ hasText: /You're offline/ })).toContainText(
		"New entries are sent when you're back."
	);
	await context.setOffline(false);
});

test('a tab left open never sends its waiting entries into the account of someone who signed in since', async ({
	page,
	context
}) => {
	const ayse = await signedInAs(page, 'Ayşe');
	await primeCache(page);
	await context.setOffline(true);
	await page
		.getByRole('region', { name: 'Water' })
		.getByRole('button', { name: 'Add 250 ml of water' })
		.click();
	await quickAdd(page, '300', 'Simit');

	// Someone else signs in on this browser (in another tab: the session cookie is the browser's, not the tab's).
	await signedInAs(page, 'Mehmet');
	await context.setOffline(false);
	const reloaded = page.waitForEvent('load');
	await page.evaluate(() => dispatchEvent(new Event('online')));
	// The server refuses entries meant for Ayşe, and the tab reloads as the person now signed in.
	await reloaded;
	await page.goto('/');
	await expect(page.getByRole('heading', { level: 1, name: 'Today' })).toBeVisible();
	const date = await page.evaluate(() => new Date().toLocaleDateString('en-CA'));
	const day = () =>
		apiAs<{ entries: { description: string }[] }>(page, 'GET', `/api/v1/diary/${date}`);
	expect((await day()).entries).toEqual([]);
	await expect(page.getByRole('region', { name: 'Water' })).not.toContainText('250 ml');
	// Ayşe's entries wait on this device, in her own queue.
	const waiting = await page.evaluate(
		(id) =>
			new Promise<number>((resolve) => {
				const open = indexedDB.open(`obur-queue-${id}`);
				open.onsuccess = () => {
					const count = open.result.transaction('ops').objectStore('ops').count();
					count.onsuccess = () => resolve(count.result);
				};
			}),
		ayse
	);
	expect(waiting).toBe(2);

	// When she signs in again, they arrive in her account.
	await signedInAgain(page, ayse);
	await page.reload();
	const snacks = page.getByRole('region', { name: 'Snacks' });
	await expect(snacks).toContainText('Simit');
	await expect(snacks.getByText('Waiting to sync')).toHaveCount(0);
	await expect(page.getByRole('region', { name: 'Water' })).toContainText('250 ml');
	expect((await day()).entries.map((e) => e.description)).toEqual(['Simit']);
});

test("someone signing in on this browser never sees the previous person's saved pages, even offline", async ({
	page,
	context
}) => {
	await signedInAs(page, 'Ayşe');
	const date = await page.evaluate(() => new Date().toLocaleDateString('en-CA'));
	const zone = await page.evaluate(() => Intl.DateTimeFormat().resolvedOptions().timeZone);
	await apiAs(page, 'POST', '/api/v1/diary/entries', {
		kind: 'quick',
		id: crypto.randomUUID(),
		date,
		meal: 'snacks',
		zone,
		kcal: 300,
		description: 'Simit'
	});
	await primeCache(page);
	await expect
		.poll(() =>
			page.evaluate(async () => {
				const hit = await (await caches.open('obur-data-v2')).match(location.origin + '/');
				return hit ? hit.text() : '';
			})
		)
		.toContain('Simit');

	// Mehmet signs in on this browser (another tab), and the connection drops before any page here could clear
	// Ayşe's copies. Signing in is a write, and its answer says who is signed in now; a refused write stands in.
	await signedInAs(page, 'Mehmet');
	await page.evaluate(() =>
		fetch('/api/v1/diary/entries', {
			method: 'POST',
			headers: { 'content-type': 'application/json' },
			body: '{}'
		})
	);
	await context.setOffline(true);
	await page.reload().catch(() => {});
	await expect(page.locator('body')).not.toContainText('Simit');
	await context.setOffline(false);
});

test('an entry discarded while it is being sent stays discarded when that send fails', async ({
	page,
	context,
	browserName
}) => {
	test.skip(
		browserName === 'webkit',
		'request interception does not apply under a service worker in WebKit'
	);
	await signedInAs(page, 'Elif');
	await primeCache(page);
	await context.setOffline(true);
	await quickAdd(page, '300', 'Simit');
	await page.goto('/');

	// Back online, the send hangs (a poor connection) until this test lets it fail.
	let fail = () => {};
	const failed = new Promise<void>((resolve) => (fail = resolve));
	let sending = false;
	let aborted = false;
	await context.route('**/api/v1/diary/entries', async (route) => {
		sending = true;
		await failed;
		await route.abort();
		aborted = true;
	});
	await context.setOffline(false);
	await page.evaluate(() => dispatchEvent(new Event('online')));
	await expect.poll(() => sending).toBe(true);

	const snacks = page.getByRole('region', { name: 'Snacks' });
	await snacks.getByText('Waiting to sync').click();
	await page
		.getByRole('dialog', { name: 'Unsent entry' })
		.getByRole('button', { name: 'Discard' })
		.click();
	await expect(snacks.getByText('Waiting to sync')).toHaveCount(0);

	// The send fails; the discarded entry must not come back, and nothing is sent later.
	fail();
	await expect.poll(() => aborted).toBe(true);
	await context.unroute('**/api/v1/diary/entries');
	const queued = () =>
		page.evaluate(async () => {
			const name = (await indexedDB.databases()).find((d) =>
				d.name?.startsWith('obur-queue-')
			)?.name;
			return new Promise<number>((resolve) => {
				const open = indexedDB.open(name!);
				open.onsuccess = () => {
					const count = open.result.transaction('ops').objectStore('ops').count();
					count.onsuccess = () => resolve(count.result);
				};
			});
		});
	await page.waitForTimeout(500);
	expect(await queued()).toBe(0);
	await page.evaluate(() => dispatchEvent(new Event('online')));
	await page.reload();
	await expect(page.getByRole('heading', { level: 1, name: 'Today' })).toBeVisible();
	await expect(snacks).not.toContainText('Simit');
	const date = await page.evaluate(() => new Date().toLocaleDateString('en-CA'));
	const day = await apiAs<{ entries: unknown[] }>(page, 'GET', `/api/v1/diary/${date}`);
	expect(day.entries).toEqual([]);
});

test('after signing out, nothing of the account answers offline, not even the food copy in memory', async ({
	page,
	context
}, testInfo) => {
	// 2026-11-20 audit: the service worker kept the account and its food copy in memory after a sign-out.
	await signedInAs(page, 'Mehmet');
	const name = `Quince jam ${testInfo.project.name}`;
	await createFood(page, {
		name,
		basis: '100g',
		nutrients: [{ code: 'energy_kcal', value: 250, qualifier: 'reported' }]
	});
	await primeCache(page);
	const offlineSearch = () =>
		page.evaluate(async () => {
			const r = await fetch('/__offline/foods?q=quince');
			return r.ok ? ((await r.json()) as { results: { name: string }[] }).results.length : r.status;
		});
	await expect.poll(offlineSearch, { timeout: 15_000 }).toBe(1);

	const nav = page.getByRole('navigation', { name: 'Main' }).filter({ visible: true });
	await nav.getByRole('link', { name: 'More' }).click();
	await page.getByRole('button', { name: 'Sign out' }).click();
	await expect(page).toHaveURL(/\/login$/);
	await context.setOffline(true);
	expect(await offlineSearch()).toBe(503);
});

test('signing out removes the waiting-entries store even while another tab has it open', async ({
	page,
	context
}) => {
	await signedInAs(page, 'Mehmet');
	await primeCache(page);
	const other = await context.newPage();
	await other.goto('/');
	const queues = (p: Page) =>
		p.evaluate(async () =>
			(await indexedDB.databases()).map((d) => d.name).filter((n) => n?.startsWith('obur-queue-'))
		);
	await expect.poll(() => queues(other)).toHaveLength(1);

	const nav = page.getByRole('navigation', { name: 'Main' }).filter({ visible: true });
	await nav.getByRole('link', { name: 'More' }).click();
	await page.getByRole('button', { name: 'Sign out' }).click();
	await expect(page).toHaveURL(/\/login$/);
	expect(await queues(page)).toEqual([]);
	await expect(page.getByText("Close obur's other tabs")).toHaveCount(0);
	await other.close();
});

test('after a sign-out and sign-in in another tab, an entry made offline in an older tab still waits on the device', async ({
	page,
	context
}) => {
	// 2026-11-20 audit: the older tab kept the queue connection the sign-out closed, so the entry failed.
	const userId = await signedInAs(page, 'Mehmet');
	await primeCache(page);
	const other = await context.newPage();
	await other.goto('/');
	await expect(other.getByRole('heading', { level: 1, name: 'Today' })).toBeVisible();

	const nav = page.getByRole('navigation', { name: 'Main' }).filter({ visible: true });
	await nav.getByRole('link', { name: 'More' }).click();
	await page.getByRole('button', { name: 'Sign out' }).click();
	await expect(page).toHaveURL(/\/login$/);
	await signedInAgain(page, userId);
	// Signed in again, the app saves its pages again; the older tab stays open as it was.
	await primeCache(page);

	await context.setOffline(true);
	await quickAdd(other, '90', 'Pear');
	await context.setOffline(false);
	await other.close();
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
	await expect(page.getByRole('status').filter({ hasText: 'Saved on this device' })).toBeVisible();
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

test('with a hanging connection, at most one page change waits; the ones after it open from the saved copy at once', async ({
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
	// The first moves may open from pages prepared before the connection went, or wait for it once; never more.
	let waits = 0;
	for (const [link, title] of [
		['Progress', 'Progress'],
		['Today', 'Today'],
		['Journal', 'Journal']
	]) {
		const started = Date.now();
		await nav.getByRole('link', { name: link }).click();
		await expect(page.getByRole('heading', { level: 1, name: title })).toBeVisible({
			timeout: 6000
		});
		if (Date.now() - started > 1500) waits++;
	}
	expect(waits).toBeLessThanOrEqual(1);
	// After that, every tab opens at once.
	const started = Date.now();
	await nav.getByRole('link', { name: 'More' }).click();
	await expect(page.getByRole('heading', { level: 1, name: 'More' })).toBeVisible();
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
	// Search answers from this device's copy of the person's foods (none match here) and offers quick add.
	await page.getByLabel('Search foods').fill('qwzx');
	await expect(page.getByText('No food found for “qwzx”.')).toBeVisible();
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

test('a note typed offline, then a newer one on another device: the card shows the one kept and says so', async ({
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
	await note.getByRole('button', { name: 'Done' }).click();

	// Meanwhile the same person writes the day's note on another device, later (the test's own requests are not
	// offline; the phone is).
	const date = await page.evaluate(() => new Date().toLocaleDateString('en-CA'));
	await apiAs(page, 'POST', `/api/v1/diary/days/${date}/note`, {
		id: crypto.randomUUID(),
		text: 'typed at home',
		typedAt: new Date().toISOString()
	});

	await context.setOffline(false);
	await page.evaluate(() => dispatchEvent(new Event('online')));
	await expect(note).toContainText('A newer version from another device was kept', {
		timeout: 15_000
	});
	await expect(note).toContainText('typed at home');
	await expect(note).not.toContainText('typed on the train');
	await expect(note).not.toContainText(/Saved \S+/);
	await page.reload();
	await expect(note).toContainText('typed at home');
});

test('an entry the server refused after waiting offline stays until the person chooses: calories, another food or discard', async ({
	page,
	browser
}, testInfo) => {
	const tag = testInfo.project.name;
	// A queued entry names a food this person can't use (here someone else's), so the server refuses it.
	const mehmet = await browser.newPage();
	await signedInAs(mehmet, `Paylaşan ${tag}`);
	const name = `Mercimek çorbası ${tag}`;
	const foodId = await createFood(mehmet, {
		name,
		basis: '100g',
		nutrients: [{ code: 'energy_kcal', value: 180, qualifier: 'reported' }]
	});
	await mehmet.close();
	const userId = await signedInAs(page, `Çevrimdışı ${tag}`);
	await page.goto('/');
	const date = await page.evaluate(() => new Date().toLocaleDateString('en-CA'));
	// The entry as the app keeps it on the phone while offline (client/offline/store.ts).
	await page.evaluate(
		async ({ userId, foodId, name, date }) => {
			const db = await new Promise<IDBDatabase>((resolve, reject) => {
				const req = indexedDB.open(`obur-queue-${userId}`, 1);
				req.onupgradeneeded = () =>
					req.result.createObjectStore('ops', { keyPath: 'seq', autoIncrement: true });
				req.onsuccess = () => resolve(req.result);
				req.onerror = () => reject(req.error);
			});
			const id = crypto.randomUUID();
			await new Promise((resolve, reject) => {
				const req = db
					.transaction('ops', 'readwrite')
					.objectStore('ops')
					.add({
						id,
						ownerId: userId,
						path: '/api/v1/diary/entries',
						body: {
							id,
							kind: 'food',
							foodId,
							amount: 100,
							unit: { kind: 'mass', unit: 'g' },
							date,
							meal: 'lunch',
							zone: 'Europe/Istanbul'
						},
						preview: {
							kind: 'diary',
							localDate: date,
							meal: 'lunch',
							name,
							quantity: '100 g',
							kcal: 180
						},
						createdAt: new Date().toISOString(),
						attempts: 0,
						status: 'pending'
					});
				req.onsuccess = resolve;
				req.onerror = () => reject(req.error);
			});
			db.close();
		},
		{ userId, foodId, name, date }
	);
	await page.reload();

	// The server refuses it; the phone keeps it and says so at the top of Today.
	const card = page.getByRole('button', { name: /1 entry couldn't be saved/ });
	await expect(card).toBeVisible();
	await expect(card).toContainText("It's kept on this phone until you choose what to do.");
	await card.click();
	const sheet = page.getByRole('dialog', { name: "Couldn't save this entry" });
	await expect(sheet).toContainText(name);
	await expect(sheet).toContainText('100 g · 180 kcal · Lunch');
	await expect(sheet).toContainText('made private by the person who added it');

	// Calories only, then Undo puts the refused entry back.
	await sheet.getByRole('button', { name: 'Keep it as 180 kcal, calories only' }).click();
	const toast = page.getByRole('status').filter({ hasText: 'Saved as calories only' });
	await expect(toast).toContainText(`${name} · 180 kcal · Lunch`);
	const lunch = page.getByRole('region', { name: 'Lunch' });
	await expect(lunch).toContainText(name);
	await expect(lunch).toContainText('180');
	await expect(lunch).not.toContainText("Couldn't be saved");
	await expect(card).toBeHidden();
	await toast.getByRole('button', { name: 'Undo' }).click();
	await expect(card).toBeVisible();
	await expect(lunch).toContainText("Couldn't be saved · tap to choose");

	// Discard, and Undo.
	await card.click();
	await sheet.getByRole('button', { name: 'Discard this entry' }).click();
	const gone = page.getByRole('status').filter({ hasText: 'Entry discarded' });
	await expect(card).toBeHidden();
	await gone.getByRole('button', { name: 'Undo' }).click();
	await expect(card).toBeVisible();

	// Another food: Log opens for that day and meal with the name searched.
	await card.click();
	await sheet.getByRole('button', { name: 'Choose another food' }).click();
	await expect(page).toHaveURL(/\/log\?/);
	await expect(page.getByRole('searchbox').first()).toHaveValue(name);
});

test('an entry that waited offline never takes values the person did not see: a changed food asks first', async ({
	page,
	context
}, testInfo) => {
	const tag = testInfo.project.name;
	await signedInAs(page, 'Ayşe');
	const name = `Lentil soup ${tag}`;
	const food = {
		name,
		basis: '100g',
		nutrients: [{ code: 'energy_kcal', value: 100, qualifier: 'reported' }]
	};
	const foodId = await createFood(page, food);
	await primeCache(page);
	await page
		.getByRole('region', { name: 'Lunch' })
		.getByRole('button', { name: 'Add food to Lunch' })
		.click();
	await page.getByRole('searchbox').fill(name);
	await page.getByRole('button', { name: new RegExp(name) }).click();
	const sheet = page.getByRole('dialog');
	await expect(sheet.getByText('100 kcal per 100 g')).toBeVisible();

	// Saved offline at 100 kcal; meanwhile the food is changed on another device.
	await context.setOffline(true);
	await sheet.getByRole('button', { name: /^Log to/ }).click();
	await expect(page.getByRole('status').filter({ hasText: 'Saved on this device' })).toBeVisible();
	await apiAs(page, 'PUT', `/api/v1/foods/${foodId}`, {
		version: 1,
		food: {
			...food,
			brand: null,
			servings: [],
			nutrients: [{ code: 'energy_kcal', value: 250, qualifier: 'reported' }]
		}
	});
	await context.setOffline(false);
	await page.goto('/');

	// Not logged at the new 250 kcal: kept on the phone, with the reason and the calories that were seen.
	const card = page.getByRole('button', { name: /1 entry couldn't be saved/ });
	await expect(card).toBeVisible();
	const date = await page.evaluate(() => new Date().toLocaleDateString('en-CA'));
	const day = await apiAs<{ entries: unknown[] }>(page, 'GET', `/api/v1/diary/${date}`);
	expect(day.entries).toEqual([]);
	await card.click();
	const review = page.getByRole('dialog', { name: "Couldn't save this entry" });
	await expect(review).toContainText('This food was changed after you logged it.');
	await expect(
		review.getByRole('button', { name: 'Keep it as 100 kcal, calories only' })
	).toBeVisible();
});

test('a save that landed but whose answer was lost is acknowledged when sent again, even after the food changed', async ({
	page
}, testInfo) => {
	// 2026-11-20 audit: the retry was refused as "food changed", and the review then offered to log it again.
	await signedInAs(page, 'Ayşe');
	const food = {
		name: `Barley soup ${testInfo.project.name}`,
		basis: '100g',
		nutrients: [{ code: 'energy_kcal', value: 100, qualifier: 'reported' }]
	};
	const foodId = await createFood(page, food);
	const detail = await apiAs<FoodDetail>(page, 'GET', `/api/v1/foods/${foodId}`);
	const date = await page.evaluate(() => new Date().toLocaleDateString('en-CA'));
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
	await snacks.getByRole('button', { name: 'Add food to Snacks' }).click();
	await openCaloriesOnly(page);
	const sheet = page.getByRole('dialog', { name: 'Log calories only' });
	await sheet.getByLabel('Calories (kcal)').fill('120');
	await sheet.getByLabel('What was it? (optional)').fill('Apple');
	await sheet.getByRole('button', { name: 'Save' }).click();
	if (isPhone(page))
		await expect(page.getByRole('heading', { level: 1, name: 'Today' })).toBeVisible();
	await snacks.getByRole('button', { name: /Apple/ }).click();
	await page.getByRole('dialog').getByRole('button', { name: 'Delete' }).click();
	await expect(snacks.getByRole('button', { name: /Apple/ })).toHaveCount(0);

	await context.setOffline(true);
	await page.getByRole('status').getByRole('button', { name: 'Undo' }).click();
	await expect(page.getByRole('status').filter({ hasText: "Couldn't undo" })).toBeVisible();
	await expect(snacks.getByRole('button', { name: /Apple/ })).toHaveCount(0);
	await context.setOffline(false);
});

test('signing out offline says it needs a connection and keeps the person signed in', async ({
	page,
	context
}) => {
	await signedInAs(page, 'Zeynep');
	await primeCache(page);
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
