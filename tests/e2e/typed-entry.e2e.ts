import { expect, test, type Page } from '@playwright/test';
import { createFood, signedInAs, choose } from './fixtures.ts';

const isPhone = (page: Page) => (page.viewportSize()?.width ?? 1000) < 760;

test('a typed sentence becomes items to confirm, logged together and undone together', async ({
	page
}, testInfo) => {
	const tag = testInfo.project.name.replace(/[^a-z]/gi, '');
	await signedInAs(page, `Ece ${tag}`);
	await createFood(page, {
		name: `Tahıllı Ekmek ${tag}`,
		brand: 'Fırıncı',
		basis: '100g',
		nutrients: [{ code: 'energy_kcal', value: 250, qualifier: 'reported' }],
		servings: [{ name: 'dilim', amount: 30, unit: 'g' }]
	});
	await page.goto(isPhone(page) ? '/log' : '/');

	// Plain food names stay a search; a sentence is offered as an entry.
	await page
		.getByRole('searchbox')
		.fill(`kahvaltıda iki dilim tahıllı ekmek ${tag} ve iki bardak su`);
	await page.getByRole('button', { name: /Log as typed.*2 items · Today/ }).click();
	const sheet = page.getByRole('dialog', { name: 'Check and log' });
	const bread = sheet.getByRole('region', { name: `Fırıncı Tahıllı Ekmek ${tag}` });
	await expect(bread.getByRole('button', { name: /^Unit: dilim \(30 g\)/ })).toBeVisible();
	await expect(bread).toContainText('150 kcal'); // 2 × 30 g at 250 kcal per 100 g
	await expect(sheet.getByRole('region', { name: 'Water' }).getByLabel('Millilitres')).toHaveValue(
		'400'
	);
	await expect(sheet.getByRole('button', { name: /^Meal: Breakfast/ })).toBeVisible();

	// A vague amount must be filled in before anything can be logged.
	await sheet.getByLabel('You typed').fill(`biraz tahıllı ekmek ${tag} ve iki bardak su`);
	await sheet.getByRole('button', { name: 'Read again' }).click();
	await expect(sheet).toContainText('How much? Enter an amount.');
	await expect(sheet.getByRole('button', { name: 'Log all (2)' })).toBeDisabled();
	await sheet.getByLabel('Amount').fill('2');
	await choose(sheet, 'Unit', 'dilim (30 g)');
	await sheet.getByRole('button', { name: 'Log all (2)' }).click();

	const toast = page.getByRole('status');
	await expect(toast).toContainText('Logged 2 items');
	await expect(page.getByRole('region', { name: 'Breakfast' })).toContainText('150');
	await expect(page.getByRole('region', { name: 'Water' })).toContainText('400 ml');
	await toast.getByRole('button', { name: 'Undo' }).click();
	await expect(page.getByRole('region', { name: 'Breakfast' })).toContainText(
		'Nothing logged yet.'
	);
	await expect(page.getByRole('region', { name: 'Water' })).toContainText('0 ml');
});

test('weight, calories-only and a curated food with a bare count', async ({ page }, testInfo) => {
	await signedInAs(page, `Kaan ${testInfo.project.name}`);
	await page.goto(isPhone(page) ? '/log' : '/');
	await page.getByRole('searchbox').fill('bugün 80,5 kiloydum');
	await page.getByRole('button', { name: /Log as typed/ }).click();
	const sheet = page.getByRole('dialog', { name: 'Check and log' });
	await expect(sheet.getByLabel('Weight (kg)')).toHaveValue('80,5');
	// Change the sentence: a curated banana and a calories-only snack.
	await sheet.getByLabel('You typed').fill('bir muz ve 120 kcal snack');
	await sheet.getByRole('button', { name: 'Read again' }).click();
	const banana = sheet.getByRole('region', { name: 'Banana' });
	await expect(banana.getByRole('button', { name: /^Unit: medium/ })).toBeVisible();
	await expect(banana).toContainText('105 kcal');
	await expect(
		sheet.getByRole('region', { name: 'Calories only' }).getByLabel('Calories (kcal)')
	).toHaveValue('120');
	await sheet.getByRole('button', { name: 'Log all (2)' }).click();
	await expect(page.getByRole('status')).toContainText('Logged 2 items');
	await expect(page.getByRole('region', { name: 'Snacks' })).toContainText('Banana');
});
