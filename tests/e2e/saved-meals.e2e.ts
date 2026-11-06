import { expect, test, type Page } from '@playwright/test';
import { apiAs, createFood, signedInAs, choose } from './fixtures.ts';

const isPhone = (page: Page) => (page.viewportSize()?.width ?? 1000) < 760;

test('save a meal, log it to another day and meal, undo, then edit and delete it', async ({
	page
}, testInfo) => {
	const tag = testInfo.project.name;
	await signedInAs(page, `Selin ${tag}`);
	const foodId = await createFood(page, {
		name: `Beyaz Peynir ${tag}`,
		brand: null,
		basis: '100g',
		nutrients: [{ code: 'energy_kcal', value: 250, qualifier: 'reported' }],
		servings: []
	});
	const today = await page.evaluate(() => new Date().toLocaleDateString('en-CA'));
	const zone = 'Europe/Istanbul';
	await apiAs(page, 'POST', '/api/v1/diary/entries', {
		kind: 'food',
		date: today,
		meal: 'breakfast',
		zone,
		foodId,
		amount: 40,
		unit: { kind: 'mass', unit: 'g' }
	});
	await apiAs(page, 'POST', '/api/v1/diary/entries', {
		kind: 'quick',
		date: today,
		meal: 'breakfast',
		zone,
		kcal: 60,
		description: 'Çay ve zeytin'
	});

	// Save Breakfast as a meal.
	await page.goto('/');
	const breakfast = page.getByRole('region', { name: 'Breakfast' });
	await breakfast.getByRole('button', { name: 'Save Breakfast as a meal' }).click();
	const save = page.getByRole('dialog', { name: 'Save as a meal' });
	await save.getByLabel('Name').fill('Pazar kahvaltısı');
	await expect(save.getByRole('checkbox')).toHaveCount(2);
	await save.getByRole('button', { name: 'Save meal' }).click();
	await expect(page.getByRole('status')).toContainText('Saved “Pazar kahvaltısı”');

	// Log it from search (Turkish-insensitive) to Yesterday's dinner, without the tea.
	if (isPhone(page)) await page.goto('/log');
	await page.getByRole('searchbox').fill('pazar kahvaltisi');
	await page.getByRole('button', { name: /Pazar kahvaltısı.*2 items · 160 kcal/ }).click();
	const sheet = page.getByRole('dialog', { name: 'Pazar kahvaltısı' });
	await sheet.getByRole('checkbox', { name: /Çay ve zeytin/ }).uncheck();
	await choose(sheet, 'Day', 'Yesterday');
	await choose(sheet, 'Meal', 'Dinner');
	await sheet.getByRole('button', { name: 'Log 1 item · 100 kcal' }).click();
	await expect(page.getByRole('heading', { level: 1, name: 'Yesterday' })).toBeVisible();
	const dinner = page.getByRole('region', { name: 'Dinner' });
	await expect(dinner).toContainText(`Beyaz Peynir ${tag}`);
	await expect(dinner).toContainText('100 kcal');
	const toast = page.getByRole('status');
	await expect(toast).toContainText('Logged 1 item');
	await toast.getByRole('button', { name: 'Undo' }).click();
	await expect(dinner).toContainText('Nothing logged yet.');

	// Managing is separate from logging: the sheet links to the editor.
	if (isPhone(page)) await page.goto('/log');
	await page.getByRole('searchbox').fill('pazar');
	await page.getByRole('button', { name: /Pazar kahvaltısı/ }).click();
	await page.getByRole('dialog').getByRole('link', { name: 'Edit meal' }).click();
	await expect(page.getByRole('heading', { level: 1, name: 'Edit saved meal' })).toBeVisible();

	// Rename, change an amount, remove the tea; nothing is logged.
	await page.getByLabel('Name').fill('Hafta sonu');
	await page.getByRole('button', { name: new RegExp(`Beyaz Peynir ${tag}`) }).click();
	await page.getByLabel('Amount').fill('80');
	await expect(page.getByRole('region', { name: 'Foods' })).toContainText('260 kcal');
	await page.getByRole('button', { name: /Çay ve zeytin/ }).click();
	await page.getByRole('button', { name: 'Remove from meal' }).click();
	await expect(page.getByRole('region', { name: 'Foods' })).toContainText('200 kcal');
	await expect(page.getByRole('button', { name: 'Update to current food values' })).toBeDisabled();
	await page.getByRole('button', { name: 'Save', exact: true }).click();
	await expect(page.getByRole('status')).toContainText('Saved “Hafta sonu”');
	await expect(page.getByRole('main')).toContainText('1 item · 200 kcal');

	// Update to current values, then delete.
	await page.getByRole('link', { name: /Hafta sonu/ }).click();
	await page.getByRole('button', { name: 'Update to current food values' }).click();
	await expect(page.getByRole('status')).toContainText('Updated: 1 · Kept as saved: 0');
	await page.getByRole('button', { name: 'Delete saved meal' }).click();
	await page.getByRole('button', { name: 'Delete for good' }).click();
	await expect(page.getByRole('status')).toContainText('Deleted “Hafta sonu”');
	await expect(page.getByRole('main')).toContainText('No saved meals yet.');

	// The diary entries it was saved from are untouched.
	await page.goto('/');
	await expect(page.getByRole('region', { name: 'Breakfast' })).toContainText('160 kcal');
});

test('create a saved meal from scratch, without logging anything', async ({ page }, testInfo) => {
	const tag = testInfo.project.name;
	await signedInAs(page, `Deniz ${tag}`);
	await createFood(page, {
		name: `Yulaf ${tag}`,
		brand: null,
		basis: '100g',
		nutrients: [{ code: 'energy_kcal', value: 380, qualifier: 'reported' }],
		servings: [{ name: 'kase', amount: 40, unit: 'g' }]
	});
	await page.goto('/saved-meals');
	await page.getByRole('link', { name: 'New meal' }).click();
	await page.getByRole('button', { name: 'Save', exact: true }).click();
	await expect(page.getByText('Add at least one food.')).toBeVisible();

	await page.getByLabel('Name').fill('Sabah yulafı');
	await page.getByRole('button', { name: 'Add food' }).click();
	const add = page.getByRole('dialog', { name: 'Add a food' });
	await add.getByLabel('Search foods').fill(`yulaf ${tag}`);
	await add.getByRole('button', { name: new RegExp(`Yulaf ${tag}`) }).click();
	const amount = page.getByRole('dialog', { name: `Yulaf ${tag}` });
	await choose(amount, 'Unit', 'kase (40 g)');
	await amount.getByLabel('Amount').fill('1,5');
	await amount.getByRole('button', { name: 'Add to meal' }).click();
	await expect(page.getByRole('region', { name: 'Foods' })).toContainText('228 kcal');
	await page.getByRole('button', { name: 'Save', exact: true }).click();
	await expect(page.getByRole('status')).toContainText('Saved “Sabah yulafı”');
	await expect(page.getByRole('main')).toContainText('1 item · 228 kcal');

	await page.goto('/');
	await expect(page.getByRole('region', { name: 'Breakfast' })).toContainText(
		'Nothing logged yet.'
	);
});
