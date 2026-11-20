// Speed on a simulated phone connection, for before-and-after comparisons (docs/design.md, "Connection required":
// the owner's condition that removing offline support makes nothing slower). Not a pass/fail test: it prints
// medians. Runs only with OBUR_SPEED=1, e.g. `OBUR_SPEED=1 npm run test:e2e -- speed.e2e.ts`.
//
// A second copy of the built server runs behind a delay proxy in this process, so every request, the service
// worker's included, pays a phone-like round trip in both browsers. Chromium also gets a 4x slower processor.
import { spawn, type ChildProcess } from 'node:child_process';
import net from 'node:net';
import { expect, test, type Page } from '@playwright/test';
import { e2eEnv } from '../../playwright.config.ts';
import { signedInAs } from './fixtures.ts';

const SERVER_PORT = 4195;
const PROXY_PORT = 4196;
const ORIGIN = `http://localhost:${PROXY_PORT}`;
/** Half of a 150 ms round trip each way, and about 10 Mbit/s: an ordinary 4G connection. */
const ONE_WAY_MS = 75;
const BYTES_PER_MS = 1250;
const ROUNDS = 5;

test.skip(!process.env.OBUR_SPEED, 'measurement only (OBUR_SPEED=1)');
test.use({ baseURL: ORIGIN });
test.describe.configure({ mode: 'serial' });

let server: ChildProcess | undefined;
let proxy: net.Server | undefined;

/** Passes bytes on after the delay and at the rate above, in order. */
function delayed(from: net.Socket, to: net.Socket) {
	let due = 0;
	from.on('data', (chunk) => {
		const now = Date.now();
		due = Math.max(due, now + ONE_WAY_MS) + chunk.length / BYTES_PER_MS;
		setTimeout(() => to.writable && to.write(chunk), due - now);
	});
	from.on('end', () => setTimeout(() => to.end(), Math.max(0, due - Date.now())));
	from.on('error', () => to.destroy());
}

test.beforeAll(async () => {
	server = spawn('node', ['server.js'], {
		env: {
			...process.env,
			...e2eEnv,
			PUBLIC_ORIGIN: ORIGIN,
			PORT: String(SERVER_PORT),
			HOST: '127.0.0.1'
		},
		stdio: 'ignore'
	});
	proxy = net.createServer((client) => {
		const upstream = net.connect(SERVER_PORT, '127.0.0.1');
		delayed(client, upstream);
		delayed(upstream, client);
	});
	await new Promise<void>((r) => proxy!.listen(PROXY_PORT, '127.0.0.1', r));
	for (let i = 0; i < 100; i++) {
		const up = await fetch(`http://127.0.0.1:${SERVER_PORT}/login`).then(
			(r) => r.ok,
			() => false
		);
		if (up) return;
		await new Promise((r) => setTimeout(r, 200));
	}
	throw new Error('server did not start');
});

test.afterAll(async () => {
	server?.kill();
	await new Promise((r) => proxy?.close(r));
});

const median = (xs: number[]) => [...xs].sort((a, b) => a - b)[Math.floor(xs.length / 2)];
const results: Record<string, number[]> = {};
const note = (name: string, ms: number) => (results[name] ??= []).push(ms);

async function slowProcessor(page: Page) {
	if (page.context().browser()?.browserType().name() !== 'chromium') return;
	const cdp = await page.context().newCDPSession(page);
	await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 });
}

const heading = (page: Page, name: string) =>
	page.getByRole('heading', { level: 1, name }).filter({ visible: true });
const tabs = (page: Page) =>
	page.getByRole('navigation', { name: 'Main' }).filter({ visible: true });

/** Signed in, with the service worker installed and in charge, as on a phone that has used the app before. */
async function installed(page: Page) {
	await signedInAs(page, 'Speed Check');
	await page.goto('/');
	await page.evaluate(() => navigator.serviceWorker.ready);
	await page.reload();
	await page.waitForFunction(() => navigator.serviceWorker.controller !== null);
	await expect(heading(page, 'Today')).toBeVisible();
	// Let the first start's background work finish, so the measured starts are ordinary ones.
	await page.waitForTimeout(8000);
}

test('app start, tabs, search and a save on a phone connection', async ({ page }, testInfo) => {
	test.setTimeout(10 * 60_000);
	await installed(page);
	await slowProcessor(page);

	for (let round = 0; round < ROUNDS; round++) {
		// App start: the page loaded again, as when the app is opened (code from the service worker's copy).
		let t = Date.now();
		await page.goto('/');
		await expect(heading(page, 'Today')).toBeVisible();
		note('start: Today shown', Date.now() - t);

		// A tab tapped soon after the start, while the start's background work may still be under way.
		await page.waitForTimeout(3500);
		t = Date.now();
		await tabs(page).getByRole('link', { name: 'Journal' }).click();
		await expect(heading(page, 'Journal')).toBeVisible();
		note('tab soon after start: Journal', Date.now() - t);

		// Each main tab once the app has settled.
		await page.waitForTimeout(5000);
		for (const name of ['Today', 'Log', 'Progress', 'More', 'Journal']) {
			t = Date.now();
			await tabs(page).getByRole('link', { name }).click();
			await expect(heading(page, name)).toBeVisible();
			note(`tab: ${name}`, Date.now() - t);
			await page.waitForTimeout(1500);
		}

		// Search on Log, then log the food.
		await tabs(page).getByRole('link', { name: 'Log' }).click();
		await expect(heading(page, 'Log')).toBeVisible();
		await page.waitForTimeout(1500);
		t = Date.now();
		await page.getByRole('searchbox').fill('banana');
		const result = page.getByRole('button', { name: /^Banana/ }).first();
		await expect(result).toBeVisible();
		note('search: first result', Date.now() - t);
		await result.click();
		const sheet = page.getByRole('dialog');
		await expect(sheet.getByRole('button', { name: /^Log to/ })).toBeVisible();
		t = Date.now();
		await sheet.getByRole('button', { name: /^Log to/ }).click();
		await expect(page.getByRole('status').getByText(/^Logged to/)).toBeVisible();
		note('save: confirmation shown', Date.now() - t);
		await page.waitForTimeout(1500);
	}

	const lines = Object.entries(results).map(
		([name, xs]) =>
			`${name.padEnd(32)} median ${String(median(xs)).padStart(5)} ms  (${xs.join(', ')})`
	);
	console.log(`\n[speed] ${testInfo.project.name}\n${lines.join('\n')}\n`);
});
