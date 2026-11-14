// The interface language (docs/design.md, "Interface language"): pages are drawn in the cookie's language, else the
// phone's, and the cookie is written so the page's scripts agree. A language not enabled yet never shows, whatever
// the cookie or the phone asks for.
import { expect, test } from '@playwright/test';
import { ENABLED_LANGUAGES, LANGUAGES } from '../../src/lib/shared/languages.ts';

test('the sign-in page is drawn in an enabled language and remembers it', async ({ request }) => {
	const res = await request.get('/login', { headers: { 'accept-language': 'en-GB,en;q=0.9' } });
	expect(res.status()).toBe(200);
	expect(await res.text()).toContain('<html lang="en"');
	expect(res.headers()['set-cookie']).toContain('obur_lang=en');
});

test('a language that is not enabled yet never shows', async ({ request }) => {
	for (const hidden of LANGUAGES.filter((l) => !ENABLED_LANGUAGES.includes(l))) {
		const res = await request.get('/login', {
			headers: { cookie: `obur_lang=${hidden}`, 'accept-language': `${hidden};q=1` }
		});
		expect(await res.text()).toContain('<html lang="en"');
	}
});
