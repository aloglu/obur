import { expect, test, type Page } from '@playwright/test';
import { signedInAs } from './fixtures.ts';

const isPhone = (page: Page) => (page.viewportSize()?.width ?? 1000) < 760;

test('a curated food is found by its Turkish name and logged by a USDA portion', async ({
	page
}, testInfo) => {
	await signedInAs(page, `Deniz ${testInfo.project.name}`);
	await page.goto(isPhone(page) ? '/log' : '/');
	await page.getByRole('searchbox').fill('muz');
	await page.getByRole('button', { name: /^Banana/ }).click();
	const sheet = page.getByRole('dialog', { name: 'Banana' });
	// Portion names are metric; the gram weight is USDA's.
	await expect(sheet).not.toContainText('"');
	await sheet.getByRole('radio', { name: 'medium (18–20 cm long) (118 g)' }).click();
	await sheet.getByLabel('Amount').fill('1');
	// 89 kcal per 100 g × 118 g.
	await expect(sheet).toContainText('105 kcal');
	await sheet.getByRole('button', { name: 'Save' }).click();
	await expect(page.getByRole('status')).toContainText('105 kcal');

	// The food page says where the values come from.
	await page.goto('/foods');
	await page.getByLabel('Search foods').fill('banana');
	await page.getByRole('link', { name: /^Banana/ }).click();
	await expect(page.getByText('USDA FoodData Central (SR Legacy')).toBeVisible();
	await expect(page.getByText('Potassium (mg)')).toBeVisible();
});
