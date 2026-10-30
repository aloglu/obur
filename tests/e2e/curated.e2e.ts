import { expect, test, type Page } from '@playwright/test';
import { createFood, signedInAs } from './fixtures.ts';

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

test('the amount preview shows kcal and coloured macros, carbs never "?" when the source has them', async ({
	page
}, testInfo) => {
	const tag = testInfo.project.name.replace(/[^a-z]/gi, '');
	await signedInAs(page, `Makro ${tag}`);
	await createFood(page, {
		name: `İthal Bisküvi ${tag}`,
		brand: null,
		basis: '100g',
		nutrients: [
			{ code: 'energy_kcal', value: 450, qualifier: 'reported' },
			{ code: 'carbohydrate_unspecified', value: 70, qualifier: 'reported' },
			{ code: 'protein', value: 6, qualifier: 'reported' }
		],
		servings: []
	});
	await page.goto(isPhone(page) ? '/log' : '/');
	await page.getByRole('searchbox').fill(`ithal biskuvi ${tag}`);
	await page.getByRole('button', { name: new RegExp(`İthal Bisküvi ${tag}`) }).click();
	const sheet = page.getByRole('dialog');
	await sheet.getByLabel('Amount').fill('50');
	// LoseIt-style carbohydrate: the value, with a note; fat is unknown, not zero.
	await expect(sheet.getByRole('definition').nth(1)).toHaveText('35 g');
	await expect(sheet).toContainText('Carbs: the source did not state whether fibre is included.');
	await expect(sheet.getByRole('definition').nth(2)).toHaveText('?');
	await expect(sheet).toContainText('225 kcal');
	if (isPhone(page)) {
		await page.waitForTimeout(300);
		await page.screenshot({ path: `test-results/shot-macros-${tag}.png` });
	}
});
