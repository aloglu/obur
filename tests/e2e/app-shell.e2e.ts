import { expect, test } from '@playwright/test';

test('home page renders with self-hosted assets only', async ({ page, baseURL }) => {
	const origin = new URL(baseURL!).origin;
	const external: string[] = [];
	page.on('request', (request) => {
		const url = new URL(request.url());
		if (url.protocol.startsWith('http') && url.origin !== origin) external.push(url.href);
	});

	await page.goto('/');
	await expect(page.getByRole('heading', { level: 1, name: 'obur' })).toBeVisible();
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
