import { expect, test } from '@playwright/test';

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
