import { expect, test, type Page } from '@playwright/test';
import { createFood, signedInAs } from './fixtures.ts';

const iconIn = (scope: ReturnType<Page['locator']>, hex: string) =>
	scope.locator(`img[src="/icons/food/${hex}.svg"]`);

test('foods show the icon their name suggests, or the one chosen in the picker', async ({
	page
}, testInfo) => {
	const tag = testInfo.project.name;
	await signedInAs(page, `İkon ${tag}`);
	const id = await createFood(page, {
		name: `Beyaz peynir ${tag}`,
		brand: null,
		basis: '100g',
		nutrients: [{ code: 'energy_kcal', value: 250, qualifier: 'reported' }],
		servings: []
	});

	// Suggested from the name (peynir → cheese) in the Foods list.
	await page.goto('/foods');
	await page.getByLabel('Search foods').fill(`beyaz peynir ${tag}`);
	const row = page.getByRole('link', { name: new RegExp(`Beyaz peynir ${tag}`) });
	await expect(iconIn(row, '1F9C0')).toBeVisible();

	// Chosen in the food form: search the picker in Turkish, pick milk instead.
	await page.goto(`/foods/${id}`);
	await expect(page.getByText('Suggested from the name')).toBeVisible();
	await page.getByRole('button', { name: 'Change icon' }).click();
	const picker = page.getByRole('dialog', { name: 'Choose an icon' });
	await picker.getByLabel('Search icons').fill('süt');
	await picker.getByRole('button', { name: 'milk' }).click();
	await expect(page.getByText('Chosen by you')).toBeVisible();
	await page.getByRole('button', { name: 'Save food' }).click();
	await expect(page.getByText('Saved')).toBeVisible();

	// Logged: the meal card shows the chosen icon (from the entry's snapshot).
	await page.goto('/log');
	await page.getByRole('searchbox').fill(`beyaz peynir ${tag}`);
	const result = page.getByRole('button', { name: new RegExp(`Beyaz peynir ${tag}`) }).first();
	await expect(iconIn(result, '1F95B')).toBeVisible();
	await result.click();
	await page
		.getByRole('dialog')
		.getByRole('button', { name: /^Log to/ })
		.click();
	await expect(page.getByRole('heading', { level: 1, name: 'Today' })).toBeVisible();
	await expect(iconIn(page.getByRole('main'), '1F95B').first()).toBeVisible();
});
