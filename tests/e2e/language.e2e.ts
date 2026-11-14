// The interface language (docs/design.md, "Interface language"): pages are drawn in the cookie's language, else the
// phone's, and the cookie is written so the page's scripts agree. The main test server previews Turkish
// (OBUR_PREVIEW_LANGUAGES); the features-off server doesn't, and there it never shows.
import { expect, test } from '@playwright/test';
import { FEATURES_OFF } from '../../playwright.config.ts';
import { signedInAs } from './fixtures.ts';

test('the sign-in page follows the phone’s language, then the device remembers it', async ({
	playwright
}) => {
	const phone = (language: string) =>
		playwright.request.newContext({ extraHTTPHeaders: { 'accept-language': language } });
	const english = await (await phone('en-GB,en;q=0.9')).get('/login');
	expect(await english.text()).toContain('<html lang="en"');
	expect(english.headers()['set-cookie']).toContain('obur_lang=en');

	const turkishPhone = await phone('tr-TR,tr;q=0.9');
	const turkish = await turkishPhone.get('/login');
	const html = await turkish.text();
	expect(html).toContain('<html lang="tr"');
	expect(html).toContain('Geçiş anahtarıyla giriş yap');
	expect(turkish.headers()['set-cookie']).toContain('obur_lang=tr');
	// The device's last language comes before the phone's.
	const again = await turkishPhone.get('/login', { headers: { 'accept-language': 'en' } });
	expect(await again.text()).toContain('<html lang="tr"');
});

test('a language a server doesn’t offer never shows there', async ({ request }) => {
	const res = await request.get(`${FEATURES_OFF}/login`, {
		headers: { cookie: 'obur_lang=tr', 'accept-language': 'tr;q=1' }
	});
	const html = await res.text();
	expect(html).toContain('<html lang="en"');
	expect(html).toContain('Sign in with a passkey');
});

test('choosing Türkçe in Settings draws the app in Turkish, and English brings it back', async ({
	page
}) => {
	await signedInAs(page, 'Dil Deneyen');
	await page.goto('/more/settings');
	await page.getByRole('button', { name: /^Language:/ }).click();
	await page.getByRole('option', { name: 'Türkçe' }).click();
	await expect(page.locator('html')).toHaveAttribute('lang', 'tr');
	await expect(page.getByRole('heading', { level: 1, name: 'Ayarlar' })).toBeVisible();
	await page.goto('/');
	await expect(page.getByRole('heading', { level: 1, name: 'Bugün' })).toBeVisible();
	await expect(page.getByText('Kahvaltı', { exact: true })).toBeVisible();

	await page.goto('/more/settings');
	await page.getByRole('button', { name: /^Dil:/ }).click();
	await page.getByRole('option', { name: 'English' }).click();
	await expect(page.locator('html')).toHaveAttribute('lang', 'en');
	await expect(page.getByRole('heading', { level: 1, name: 'Settings' })).toBeVisible();
});
