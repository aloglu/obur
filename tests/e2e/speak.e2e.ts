import { expect, test } from '@playwright/test';
import { SPEECH_STUB } from '../../playwright.config.ts';
import { createFood, signedInAs } from './fixtures.ts';

// Chromium's fake microphone (set up in playwright.config.ts); WebKit in Playwright has none, so these run in desktop
// Chromium only.
test.skip(({ browserName }) => browserName !== 'chromium', 'needs a fake microphone');
test.beforeEach(async ({ context }) => {
	await context.grantPermissions(['microphone']);
});

const nextTranscript = (body: unknown, status = 200) =>
	fetch(`${SPEECH_STUB}/next`, { method: 'POST', body: JSON.stringify({ status, body }) });

test('Speak records, sends the clip with the person’s foods as a prompt, and confirms what it heard', async ({
	page
}) => {
	await signedInAs(page, 'Ses');
	await createFood(page, {
		name: 'Sesli Ayran',
		brand: 'Köy',
		basis: '100ml',
		nutrients: [{ code: 'energy_kcal', value: 40, qualifier: 'reported' }],
		servings: [{ name: 'kutu', amount: 200, unit: 'ml' }]
	});
	// Log it once so it is a recent food and part of the prompt.
	await page.goto('/');
	await page.getByRole('searchbox').fill('sesli ayran');
	await page
		.getByRole('button', { name: /Köy Sesli Ayran/ })
		.first()
		.click();
	await page.getByRole('dialog').getByRole('button', { name: 'Save' }).click();
	await expect(page.getByRole('status')).toContainText('Logged');

	await nextTranscript({
		text: 'Akşam bir kutu sesli ayran ve iki bardak su içtim.',
		language: 'tr',
		audioS: 2,
		queueMs: 0,
		asrMs: 900
	});
	await page.getByRole('button', { name: 'Speak' }).click();
	const speak = page.getByRole('dialog', { name: 'Speak' });
	await expect(speak).toContainText('Listening… say what you ate');
	await page.waitForTimeout(1200);
	await speak.getByRole('button', { name: 'Done' }).click();

	const sheet = page.getByRole('dialog', { name: 'Check and log' });
	await expect(sheet.getByLabel('I heard')).toHaveValue(
		'Akşam bir kutu sesli ayran ve iki bardak su içtim.'
	);
	await expect(sheet.getByRole('region', { name: 'Köy Sesli Ayran' })).toContainText('80 kcal');
	await expect(sheet.getByRole('button', { name: /^Meal: Dinner/ })).toBeVisible();
	const sent = await (await fetch(`${SPEECH_STUB}/last`)).json();
	expect(sent.prompt).toContain('Köy');
	expect(sent.prompt).toContain('Sesli Ayran');
	expect(sent.audioBytes).toBeGreaterThan(1000);
	await sheet.getByRole('button', { name: 'Log all (2)' }).click();
	await expect(page.getByRole('status')).toContainText('Logged 2 items');
});

test('Speak says when nothing was heard or the service is busy, and offers to try again', async ({
	page
}) => {
	await signedInAs(page, 'Sessiz');
	await page.goto('/');
	await nextTranscript({ text: '  ', language: 'tr', audioS: 1, queueMs: 0, asrMs: 300 });
	await page.getByRole('button', { name: 'Speak' }).click();
	const speak = page.getByRole('dialog', { name: 'Speak' });
	// Done at once: an empty recording is "nothing heard" too.
	await speak.getByRole('button', { name: 'Done' }).click();
	await expect(speak).toContainText('Nothing was heard.');
	await speak.getByRole('button', { name: 'Try again' }).click();
	await page.waitForTimeout(1000);
	await speak.getByRole('button', { name: 'Done' }).click();
	await expect(speak).toContainText('Nothing was heard.');
	await nextTranscript({ error: 'busy' }, 503);
	await speak.getByRole('button', { name: 'Try again' }).click();
	await page.waitForTimeout(1000);
	await speak.getByRole('button', { name: 'Done' }).click();
	await expect(speak).toContainText('The speech service is busy.');
	await speak.getByRole('button', { name: 'Type instead' }).click();
	await expect(speak).toBeHidden();
});
