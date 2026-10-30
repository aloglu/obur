import { expect, test, type Page } from '@playwright/test';
import { apiAs, createFood, signedInAs } from './fixtures.ts';

const isPhone = (page: Page) => (page.viewportSize()?.width ?? 1000) < 760;

test('save a meal, log it to another day and meal, undo, rename and delete it', async ({
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
	await sheet.getByRole('radio', { name: 'Yesterday' }).click();
	await sheet.getByRole('radio', { name: 'Dinner' }).click();
	await sheet.getByRole('button', { name: 'Log 1 item · 100 kcal' }).click();
	await expect(page.getByRole('heading', { level: 1, name: 'Yesterday' })).toBeVisible();
	const dinner = page.getByRole('region', { name: 'Dinner' });
	await expect(dinner).toContainText(`Beyaz Peynir ${tag}`);
	await expect(dinner).toContainText('100 kcal');
	const toast = page.getByRole('status');
	await expect(toast).toContainText('Logged 1 item');
	await toast.getByRole('button', { name: 'Undo' }).click();
	await expect(dinner).toContainText('Nothing logged yet.');

	// Manage it from the Saved meals page.
	await page.goto('/saved-meals');
	await page.getByRole('button', { name: /Pazar kahvaltısı/ }).click();
	const manage = page.getByRole('dialog', { name: 'Pazar kahvaltısı' });
	await manage.getByRole('button', { name: 'Rename' }).click();
	await manage.getByLabel('Name').fill('Hafta sonu');
	await manage.getByRole('button', { name: 'Save name' }).click();
	await expect(page.getByRole('dialog', { name: 'Hafta sonu' })).toBeVisible();
	await expect(page.getByRole('main')).toContainText('Hafta sonu');
	const renamed = page.getByRole('dialog', { name: 'Hafta sonu' });
	await renamed.getByRole('button', { name: 'Update to current food values' }).click();
	await expect(renamed).toContainText('Updated: 1 · Kept as saved: 0');
	await renamed.getByRole('button', { name: 'Delete saved meal' }).click();
	await renamed.getByRole('button', { name: 'Delete for good' }).click();
	await expect(page.getByRole('status')).toContainText('Deleted “Hafta sonu”');
	await expect(page.getByRole('main')).toContainText('No saved meals yet.');

	// The diary entries it was saved from are untouched.
	await page.goto('/');
	await expect(page.getByRole('region', { name: 'Breakfast' })).toContainText('160 kcal');
});
