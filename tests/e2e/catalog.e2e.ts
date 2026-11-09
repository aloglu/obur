import { expect, test, type Page } from '@playwright/test';
import { signedInAs } from './fixtures.ts';

// Nutrient inputs by field; label text alone is ambiguous ("Fat" is inside "Saturated fat").
const nutrient = (page: Page, field: string) => page.locator(`#n-${field}`);

test('a member creates a shared per-serving food that another member can find and copy', async ({
	page,
	browser
}, testInfo) => {
	// Unique per browser project, since projects share the database.
	const tag = testInfo.project.name === 'phone-webkit' ? 'Mobil' : 'Masaüstü';
	const name = `HighPro+ Çikolatalı Kaplamalı Hindistan Cevizli Protein Bar ${tag}`;
	await signedInAs(page, 'Mehmet');

	await page.goto('/foods/new');
	await page.getByLabel('Name', { exact: true }).fill(name);
	await page.getByLabel('Brand (optional)').fill('Fellas');
	await page.getByRole('radio', { name: 'per serving' }).click();
	await page.getByLabel('One serving is').fill('1 bar');
	await page.getByLabel('Serving weight or volume (optional)').fill('50');
	await nutrient(page, 'energy_kcal').fill('191');
	await nutrient(page, 'fat').fill('8,1');
	await nutrient(page, 'protein').fill('20');
	await nutrient(page, 'salt').fill('0,5');
	// An optional extra from the label, as an upper bound.
	await page.getByRole('button', { name: 'More nutrients' }).click();
	await nutrient(page, 'iron').fill('1,2');
	await page.getByRole('button', { name: 'Iron: less than' }).click();

	// Empty rows are shown as unknown, never as zero.
	await expect(nutrient(page, 'fibre')).toHaveAttribute('placeholder', 'Unknown');
	await page.getByRole('button', { name: 'Save food' }).click();

	// Saving goes back to Foods with the new food highlighted.
	const saved = page.getByRole('link', { name: /HighPro\+/ });
	await expect(saved).toHaveAttribute('data-highlight', 'true');
	await saved.click();
	await expect(page.getByRole('heading', { level: 1, name: 'Edit food' })).toBeVisible();
	await expect(page.getByLabel('Name', { exact: true })).toHaveValue(new RegExp('HighPro\\+'));
	await expect(nutrient(page, 'fibre')).toHaveValue('');
	await expect(nutrient(page, 'fat')).toHaveValue('8,1');
	// The edit form opens More nutrients when the food has any, with the value and its "<".
	await expect(nutrient(page, 'iron')).toBeVisible();
	await expect(nutrient(page, 'iron')).toHaveValue('1,2');
	await expect(page.getByRole('button', { name: 'Iron: less than' })).toHaveAttribute(
		'aria-pressed',
		'true'
	);

	// Another member finds it with a folded, reordered query and sees it read-only.
	const other = await browser.newContext({ ...testInfo.project.use });
	const otherPage = await other.newPage();
	await signedInAs(otherPage, 'Zeynep');
	await otherPage.goto('/foods');
	await otherPage.getByLabel('Search foods').fill(`highpro fellas ${tag.toLowerCase()}`);
	const result = otherPage.getByRole('link', { name: new RegExp(`HighPro\\+.*${tag}`) });
	await expect(result).toContainText('per 1 bar');
	await expect(result).toContainText('191');
	await expect(result).toContainText('Shared');
	await result.click();
	await expect(otherPage.getByText('Shared by someone in your household')).toBeVisible();

	// "Make my own variant" gives an editable private copy.
	await otherPage.getByRole('button', { name: 'Make my own variant' }).click();
	await expect(otherPage.getByText('Your variant of a shared food.')).toBeVisible();
	await expect(otherPage.getByRole('radio', { name: 'Only me' })).toHaveAttribute(
		'aria-checked',
		'true'
	);
	await other.close();
});

test('the food form warns about implausible values without blocking the save', async ({ page }) => {
	await signedInAs(page, 'Ayşe');
	await page.goto('/foods/new');
	await page.getByLabel('Name', { exact: true }).fill('Freeze Fresh Fruit Mix');
	await nutrient(page, 'energy_kcal').fill('330');
	await nutrient(page, 'carbohydrate').fill('9628');
	await expect(
		page.getByRole('alert').filter({ hasText: 'more than 100 g per 100 g' })
	).toBeVisible();
	await nutrient(page, 'sugars').fill('12,5,3');
	await expect(page.locator('label[for="n-sugars"]')).toContainText('Use a number such as 12,5');
});
