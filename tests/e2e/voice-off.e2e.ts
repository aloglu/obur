import { expect, test, type Page } from '@playwright/test';
import { FEATURES_OFF } from '../../playwright.config.ts';
import { signedInAs } from './fixtures.ts';

test('without a speech or OCR service, the tiles go, a grey card says so once, and Scan says it is off', async ({
	page
}, testInfo) => {
	await signedInAs(page, `Kapalı ${testInfo.project.name}`);
	await page.goto(`${FEATURES_OFF}/log`);
	await expect(page.getByRole('button', { name: 'Type it' })).toBeVisible();
	await expect(page.getByRole('button', { name: 'Speak' })).toHaveCount(0);
	await expect(page.getByRole('link', { name: 'Scan a label' })).toHaveCount(0);
	const card = page.getByText('Speak is off on this server');
	await expect(card).toBeVisible();
	await expect(page.getByText('Scan a label and Type it work as usual.')).toBeVisible();

	// Dismissed, it is kept with the account (saved before going on).
	await Promise.all([
		page.waitForResponse((r) => r.url().endsWith('/api/v1/profile/preferences') && r.ok()),
		page.getByRole('button', { name: 'Dismiss' }).click()
	]);
	await expect(card).toBeHidden();
	await page.reload();
	await expect(page.getByRole('button', { name: 'Type it' })).toBeVisible();
	await expect(card).toBeHidden();

	// Scan, reached by its address, says it is off rather than failing.
	await page.goto(`${FEATURES_OFF}/scan`);
	await expect(
		page.getByText("Label scanning isn't switched on for this installation.")
	).toBeVisible();
	await expect(page.getByLabel('Choose photo')).toHaveCount(0);
});

/** The microphone fails the way a phone reports it: refused, or not there at all. */
async function microphoneFails(page: Page, name: 'NotAllowedError' | 'NotFoundError') {
	await page.addInitScript((error) => {
		Object.defineProperty(navigator, 'mediaDevices', {
			configurable: true,
			value: { getUserMedia: () => Promise.reject(new DOMException('no', error)) }
		});
	}, name);
}

for (const [error, title, line] of [
	[
		'NotAllowedError',
		"obur can't use the microphone",
		'Allow the microphone for this site in your browser or phone settings, then try again.'
	],
	['NotFoundError', 'No microphone found', 'Connect one and try again, or type it instead.']
] as const) {
	test(`Speak explains a microphone ${error === 'NotAllowedError' ? 'that is refused' : 'that is missing'}`, async ({
		page
	}, testInfo) => {
		await microphoneFails(page, error);
		await signedInAs(page, `Mikrofon ${error} ${testInfo.project.name}`);
		await page.goto('/log');
		await page.getByRole('button', { name: 'Speak' }).click();
		const speak = page.getByRole('dialog', { name: 'Speak' });
		await expect(speak.getByRole('alert')).toContainText(title);
		await expect(speak.getByRole('alert')).toContainText(line);
		await speak.getByRole('button', { name: 'Type it instead' }).click();
		await expect(page.getByRole('dialog', { name: 'Type what you ate' })).toBeVisible();
	});
}
