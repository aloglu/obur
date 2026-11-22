import { expect, test, type Page } from '@playwright/test';
import { choose, signedInAs } from './fixtures.ts';

async function usePounds(page: Page) {
	await page.goto('/more/units');
	await choose(page, /^Weight:/, 'Pounds (lb)');
	await expect(page.getByRole('button', { name: 'Weight: Pounds (lb)' })).toBeVisible();
}

test('weights are shown and typed in pounds, and stored so they show again as typed', async ({
	page
}, testInfo) => {
	await signedInAs(page, `Pounds ${testInfo.project.name}`);
	await usePounds(page);
	await page.getByRole('link', { name: 'Settings', exact: true }).first().click();
	await expect(page.getByRole('link', { name: /Units.*lb · / })).toBeVisible();

	// The weigh-in field, its toast and the card.
	await page.goto('/');
	const weight = page.getByRole('region', { name: 'Weight' });
	await weight.getByRole('button', { name: 'New weigh-in' }).click();
	await expect(weight).toContainText('lb');
	await weight.getByLabel('New weight').fill('185.2');
	await weight.getByRole('button', { name: 'Save' }).click();
	await expect(page.getByRole('status')).toContainText('Saved 185.2 lb');
	await expect(weight).toContainText('185.2 lb');
	await weight.getByRole('button', { name: 'New weigh-in' }).click();
	await weight.getByLabel('New weight').fill('182');
	await weight.getByRole('button', { name: 'Save' }).click();
	await expect(weight).toContainText('182 lb');
	await expect(weight).toContainText('−3.2 lb');

	// The list of weigh-ins: shown and edited in pounds.
	await weight.getByRole('button', { name: 'Edit or delete weigh-ins' }).click();
	const sheet = page.getByRole('dialog');
	await expect(sheet).toContainText('185.2 lb');
	await sheet.getByRole('button', { name: /^Edit 182 lb/ }).click();
	await expect(sheet.getByRole('textbox')).toHaveValue('182');
	await sheet.getByRole('textbox').fill('181.4');
	await sheet.getByRole('button', { name: 'Save' }).click();
	await expect(sheet).toContainText('181.4 lb');
	await page.keyboard.press('Escape');
	await expect(weight).toContainText('181.4 lb');

	// A typed weigh-in without a unit is in pounds; one said in kilos is shown in pounds.
	await page.goto('/log');
	await page.getByRole('button', { name: 'Type it' }).click();
	const typed = page.getByRole('dialog', { name: 'Type what you ate' });
	await typed.getByLabel('You typed').fill('I weighed 80 kg');
	await expect(typed).toContainText('176.4 lb');
	await typed.getByLabel('You typed').fill('I weighed 180');
	await expect(typed).toContainText('180 lb');
	await typed.getByRole('button', { name: /^Log/ }).click();
	await expect(page.getByRole('status')).toContainText('Logged');

	// The Journal's day.
	await page.goto('/journal');
	await expect(page.getByText('180 lb', { exact: true })).toBeVisible();

	// Back to kilograms: the same weigh-in, 81.65 kg.
	await page.goto('/more/units');
	await choose(page, /^Weight:/, 'Kilograms (kg)');
	await page.goto('/');
	await expect(page.getByRole('region', { name: 'Weight' })).toContainText('81.65 kg');
});
