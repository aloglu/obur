import { expect, test, type Page } from '@playwright/test';
import { apiAs, createFood, signedInAs } from './fixtures.ts';

// Nutrient inputs by field; label text alone is ambiguous ("Fat" is inside "Saturated fat").
const nutrient = (page: Page, field: string) => page.locator(`#n-${field}`);

test('a member creates a per-serving food that only they can find', async ({
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
	// An optional extra from the label, as an upper bound: a leading "<", no separate control.
	await page.getByRole('button', { name: 'More nutrients' }).click();
	await nutrient(page, 'iron').fill('<1,2');
	await expect(page.getByRole('button', { name: /less than/ })).toHaveCount(0);

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
	await expect(nutrient(page, 'fat')).toHaveValue('8.1');
	// The edit form opens More nutrients when the food has any, with the value and its "<".
	await expect(nutrient(page, 'iron')).toBeVisible();
	await expect(nutrient(page, 'iron')).toHaveValue('<1.2');

	// It is found with a folded, reordered query, by its owner only.
	await page.goto('/foods');
	await page.getByLabel('Search foods').fill(`highpro fellas ${tag.toLowerCase()}`);
	const result = page.getByRole('link', { name: new RegExp(`HighPro\\+.*${tag}`) });
	await expect(result).toContainText('per 1 bar');
	await expect(result).toContainText('191');

	const other = await browser.newContext({ ...testInfo.project.use });
	const otherPage = await other.newPage();
	await signedInAs(otherPage, 'Zeynep');
	await otherPage.goto('/foods');
	await otherPage.getByLabel('Search foods').fill(`highpro fellas ${tag.toLowerCase()}`);
	await expect(otherPage.getByText('No foods match. Create one with New food.')).toBeVisible();
	await other.close();
});

test('makes one editable copy of a built-in food, and offers no copy of a copy', async ({
	page
}) => {
	await signedInAs(page, 'Zeynep');
	await page.goto('/foods');
	await page.getByLabel('Search foods').fill('banana');
	await page
		.getByRole('link', { name: /^Banana/ })
		.first()
		.click();
	await expect(page.getByText("A built-in food, so it can't be edited.")).toBeVisible();
	await page.getByRole('button', { name: 'Make my own variant' }).click();
	await expect(page.getByText('Your variant of a built-in food.')).toBeVisible();
	await expect(page.getByLabel('Name', { exact: true })).toHaveValue(/^Banana/);
	// It made copy after copy when this button stayed on the copy (owner report, 2026-11-17).
	await expect(page.getByRole('button', { name: 'Make my own variant' })).toHaveCount(0);
	await expect(page.getByRole('button', { name: 'Archive food' })).toBeVisible();
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
	await expect(page.locator('label[for="n-sugars"]')).toContainText('Use a number such as 12.5');
});

test('a new food the person already has offers it instead, or saves it anyway', async ({
	page
}, testInfo) => {
	const tag = testInfo.project.name;
	await signedInAs(page, `Tekrar ${tag}`);
	const existing = await createFood(page, {
		name: `Greek Yogurt ${tag}`,
		brand: 'Sütaş',
		basis: '100g',
		nutrients: [{ code: 'energy_kcal', value: 97, qualifier: 'reported' }]
	});
	const fill = async () => {
		await page.goto('/foods/new');
		await page.getByLabel('Name', { exact: true }).fill(`yogurt greek ${tag}`);
		await page.getByLabel('Brand (optional)').fill('SUTAS');
		await nutrient(page, 'energy_kcal').fill('100');
		await page.getByRole('button', { name: 'Save food' }).click();
	};

	await fill();
	const card = page.getByRole('region', { name: 'Already in your foods' });
	await expect(card).toContainText(`Greek Yogurt ${tag}, Sütaş`);
	await expect(card).toContainText('97 kcal per 100 g');
	// Enter (Go on a phone) in a field doesn't save past the match.
	await page.getByLabel('Brand (optional)').press('Enter');
	await expect(card).toBeVisible();
	await expect(page).toHaveURL(/\/foods\/new/);
	await card.getByRole('button', { name: 'Use this one' }).click();
	await expect(page).toHaveURL(new RegExp(`/foods/${existing}$`));

	// A change after the match gives Save back, and Save checks again.
	await fill();
	await expect(card).toBeVisible();
	await page.getByLabel('Brand (optional)').fill('Pınar');
	await expect(card).toBeHidden();
	await expect(page.getByRole('button', { name: 'Save food' })).toBeVisible();

	await fill();
	await page.getByRole('button', { name: 'Save mine anyway' }).click();
	const saved = page.getByRole('link', { name: new RegExp(`yogurt greek ${tag}`) });
	await expect(saved).toHaveAttribute('data-highlight', 'true');
});

test('Undo after archiving opens that food’s own form, not the one open before (2026-11-25 Review.md audit, 1.1)', async ({
	page
}, testInfo) => {
	const tag = testInfo.project.name;
	await signedInAs(page, `Undo Form ${tag}`);
	const food = (name: string) => ({
		name,
		basis: '100g',
		nutrients: [{ code: 'energy_kcal', value: 100, qualifier: 'reported' }]
	});
	const first = await createFood(page, food('Apricot Jam'));
	const second = await createFood(page, food('Plum Jam'));
	// The same version as the first will have after its archive and Undo.
	await apiAs(page, 'POST', `/api/v1/foods/${second}?action=archive`, {});
	await apiAs(page, 'POST', `/api/v1/foods/${second}?action=restore`, {});

	await page.goto(`/foods/${first}`);
	await page.getByRole('button', { name: 'Archive food' }).click();
	await expect(page).toHaveURL(/\/foods$/);
	await page.getByRole('link', { name: /Plum Jam/ }).click();
	await expect(page.getByLabel('Name', { exact: true })).toHaveValue('Plum Jam');
	await page.getByRole('status').getByRole('button', { name: 'Undo' }).click();
	await expect(page).toHaveURL(new RegExp(`/foods/${first}$`));
	await expect(page.getByLabel('Name', { exact: true })).toHaveValue('Apricot Jam');
});

test('Show more after a new food at the top skips no food (2026-11-25 Review.md audit, 2.9)', async ({
	page
}, testInfo) => {
	await signedInAs(page, `Many Foods ${testInfo.project.name}`);
	const food = (name: string) => ({
		name,
		basis: '100g',
		nutrients: [{ code: 'energy_kcal', value: 100, qualifier: 'reported' }]
	});
	for (let i = 1; i <= 51; i++) await createFood(page, food(`Food ${String(i).padStart(3, '0')}`));
	// Saved from New food, after the first page: shown at the top.
	const saved = await createFood(page, food('Zz newest'));
	await page.goto(`/foods?saved=${saved}`);
	const main = page.getByRole('main');
	await expect(main.getByRole('link', { name: /Zz newest/ })).toBeVisible();
	await expect(main.getByRole('link', { name: /Food 051/ })).toHaveCount(0);
	await main.getByRole('button', { name: 'Show more' }).click();
	await expect(main.getByRole('link', { name: /Food 051/ })).toBeVisible();
	await expect(main.getByRole('link', { name: /Zz newest/ })).toHaveCount(1);
});

test('a portion without a size, or of 0, is marked and not saved (2026-11-25 Review.md audit, 2.9)', async ({
	page
}) => {
	await signedInAs(page, 'Portion Check');
	await page.goto('/foods/new');
	await page.getByLabel('Name', { exact: true }).fill('Granola');
	await nutrient(page, 'energy_kcal').fill('450');
	await page.getByRole('button', { name: 'Add portion' }).click();
	await page.locator('#portion-name-0').fill('bowl');
	const size = page.locator('#portion-amount-0');
	for (const typed of ['', '0']) {
		await size.fill(typed);
		await page.getByRole('button', { name: 'Save food' }).click();
		await expect(size).toHaveAttribute('aria-invalid', 'true');
		await expect(page).toHaveURL(/\/foods\/new$/);
	}
	await size.fill('45');
	await expect(size).not.toHaveAttribute('aria-invalid', 'true');
});
