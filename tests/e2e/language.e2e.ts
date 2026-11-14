// The interface language (docs/design.md, "Interface language"): pages are drawn in the cookie's language, else the
// phone's, and the cookie is written so the page's scripts agree. Unknown languages never show.
import { expect, test } from '@playwright/test';
import { FEATURES_OFF, e2eEnv } from '../../playwright.config.ts';
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

test('a language obur doesn’t know is never shown or saved', async ({ page, request }) => {
	const res = await request.get(`${FEATURES_OFF}/login`, {
		headers: { cookie: 'obur_lang=xx', 'accept-language': 'xx;q=1' }
	});
	expect(await res.text()).toContain('<html lang="en"');
	await signedInAs(page, 'Bilinmeyen Dil');
	const refused = await page.request.patch('/api/v1/profile/preferences', {
		data: { language: 'xx' },
		headers: { origin: e2eEnv.PUBLIC_ORIGIN }
	});
	expect(refused.status()).toBe(400);
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
