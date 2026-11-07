import { expect, test } from '@playwright/test';
import { signedInAgain, signedInAs } from './fixtures.ts';

test('the app icon chosen on Appearance is what the Home Screen and the manifest get', async ({
	page,
	browser,
	playwright
}, testInfo) => {
	const userId = await signedInAs(page, `Simge ${testInfo.project.name}`);
	// Chromium reports these links' href to Playwright with the origin in front: the path, with or without it.
	const at = (path: string) =>
		new RegExp(`^(https?://[^/]+)?${path.replace(/[.?]/g, (c) => `\\${c}`)}$`);
	const touch = page.locator('link[rel="apple-touch-icon"]');
	const manifest = page.locator('link[rel="manifest"]');

	// Pazar by default: the original icons.
	await page.goto('/more/appearance');
	await expect(touch).toHaveAttribute('href', at('/icon-180.png'));
	await expect(manifest).toHaveAttribute('href', at('/manifest.webmanifest'));
	const icons = page.getByRole('radiogroup', { name: 'App icon' });
	await expect(icons.getByRole('radio')).toHaveCount(9);
	await expect(icons.getByRole('radio', { name: 'Pazar', exact: true })).toHaveAttribute(
		'aria-checked',
		'true'
	);
	await expect(
		page.getByText('A new icon shows after you add obur to the Home Screen again.')
	).toBeVisible();

	// Chosen: the page's links change at once, and stay after a reload.
	// Saved to the account before going on.
	await Promise.all([
		page.waitForResponse((r) => r.url().endsWith('/api/v1/profile/app-icon') && r.ok()),
		icons.getByRole('radio', { name: 'Zerde' }).click()
	]);
	await expect(touch).toHaveAttribute('href', at('/app-icons/zerde/icon-180.png'));
	await page.reload();
	await expect(touch).toHaveAttribute('href', at('/app-icons/zerde/icon-180.png'));
	await expect(manifest).toHaveAttribute('href', at('/manifest.webmanifest?icon=zerde'));
	await expect(icons.getByRole('radio', { name: 'Zerde' })).toHaveAttribute('aria-checked', 'true');

	// Kept with the account: another browser signed in as the same person (Safari, beside the Home Screen app,
	// which keeps its own cookies) gets the same icon without ever choosing it there.
	const safari = await browser.newPage();
	await signedInAgain(safari, userId);
	await safari.goto('/');
	await expect(safari.locator('link[rel="apple-touch-icon"]')).toHaveAttribute(
		'href',
		at('/app-icons/zerde/icon-180.png')
	);
	await expect(safari.locator('link[rel="manifest"]')).toHaveAttribute(
		'href',
		at('/manifest.webmanifest?icon=zerde')
	);
	await safari.close();

	// The manifest is fetched without a session, and names that icon's files, which exist.
	const anonymous = await playwright.request.newContext({ baseURL: new URL(page.url()).origin });
	const served = await anonymous.get('/manifest.webmanifest?icon=zerde');
	expect(served.status()).toBe(200);
	expect(served.headers()['cache-control']).toBe('no-store');
	const body = await served.json();
	expect(body.icons.map((i: { src: string }) => i.src)).toEqual([
		'/app-icons/zerde/icon-192.png',
		'/app-icons/zerde/icon-512.png',
		'/app-icons/zerde/icon-maskable-512.png'
	]);
	for (const { src } of body.icons) expect((await anonymous.get(src)).status()).toBe(200);
	// An unknown icon is the default.
	const fallback = await (await anonymous.get('/manifest.webmanifest?icon=nope')).json();
	expect(fallback.icons[0].src).toBe('/icon-192.png');
	await anonymous.dispose();

	// Back to Pazar.
	// Saved to the account before going on.
	await Promise.all([
		page.waitForResponse((r) => r.url().endsWith('/api/v1/profile/app-icon') && r.ok()),
		icons.getByRole('radio', { name: 'Pazar', exact: true }).click()
	]);
	await page.reload();
	await expect(touch).toHaveAttribute('href', at('/icon-180.png'));
});
