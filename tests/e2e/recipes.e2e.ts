import { expect, test, type Page } from '@playwright/test';
import { createFood, signedInAs, choose } from './fixtures.ts';

const isPhone = (page: Page) => (page.viewportSize()?.width ?? 1000) < 760;

test('create a recipe, log a serving, edit it without changing the diary, and share it as a plain food', async ({
	page,
	browser
}, testInfo) => {
	const tag = testInfo.project.name;
	await signedInAs(page, `Aşçı ${tag}`);
	await createFood(page, {
		name: `Kırmızı mercimek ${tag}`,
		brand: null,
		visibility: 'private',
		basis: '100g',
		nutrients: [
			{ code: 'energy_kcal', value: 350, qualifier: 'reported' },
			{ code: 'protein', value: 24, qualifier: 'reported' }
		],
		servings: []
	});
	await createFood(page, {
		name: `Kuru soğan ${tag}`,
		brand: null,
		basis: '100g',
		nutrients: [
			{ code: 'energy_kcal', value: 40, qualifier: 'reported' },
			{ code: 'protein', value: 1.1, qualifier: 'reported' }
		],
		servings: []
	});

	// A new recipe: 200 g lentils and 100 g onion, 4 servings, a 1200 g pot.
	await page.goto('/recipes');
	await page.getByRole('link', { name: 'New recipe' }).click();
	await page.getByLabel('Name').fill(`Mercimek çorbası ${tag}`);
	await page.getByLabel('Servings it makes').fill('4');
	await page.getByLabel('Cooked weight (g, optional)').fill('1200');
	// The icon: suggested from the name (çorba → soup), then a casserole chosen in the picker.
	await expect(page.getByText('Suggested from the name')).toBeVisible();
	await page.getByRole('button', { name: 'Change icon' }).click();
	const picker = page.getByRole('dialog', { name: 'Choose an icon' });
	await picker.getByLabel('Search icons').fill('güveç');
	await picker.getByRole('button', { name: 'casserole' }).click();
	await expect(page.getByText('Chosen by you')).toBeVisible();
	const addIngredient = async (name: string, grams: string) => {
		await page.getByRole('button', { name: 'Add food' }).click();
		const add = page.getByRole('dialog', { name: 'Add a food' });
		await add.getByLabel('Search foods').fill(name);
		await add.getByRole('button', { name: new RegExp(name) }).click();
		const amount = page.getByRole('dialog', { name: new RegExp(name) });
		await expect(amount.getByText('g', { exact: true })).toBeVisible(); // the only unit is plain text, not a menu
		await amount.getByLabel('Amount').fill(grams);
		await amount.getByRole('button', { name: 'Add to meal' }).click();
	};
	await addIngredient(`Kırmızı mercimek ${tag}`, '200');
	await addIngredient(`Kuru soğan ${tag}`, '100');
	const perServing = page.getByRole('region', { name: 'Per serving' });
	await expect(perServing).toContainText('185');
	await expect(perServing).toContainText('One serving is 300 g');
	await page.getByRole('button', { name: 'Save', exact: true }).click();
	await expect(page.getByRole('status')).toContainText(`Saved “Mercimek çorbası ${tag}”`);
	await expect(page.getByRole('main')).toContainText('185 kcal per serving · 4 servings');

	// Logged from Log like any food: by the serving, or in grams thanks to the cooked weight.
	await page.goto(isPhone(page) ? '/log' : '/');
	await page.getByRole('searchbox').fill(`mercimek corbasi ${tag}`);
	const result = page.getByRole('button', { name: new RegExp(`Mercimek çorbası ${tag}`) }).first();
	await expect(result.locator('img[src="/icons/food/1F958.svg"]')).toBeVisible();
	await result.click();
	const sheet = page.getByRole('dialog', { name: `Mercimek çorbası ${tag}` });
	await expect(sheet.getByRole('button', { name: /^Unit: / })).toBeVisible();
	await choose(sheet, 'Unit', 'g');
	await sheet.getByLabel('Amount').fill('450');
	await choose(sheet, 'Meal', 'Dinner');
	await sheet.getByRole('button', { name: 'Save', exact: true }).click();
	await expect(page.getByRole('heading', { level: 1, name: 'Today' })).toBeVisible();
	const dinner = page.getByRole('region', { name: 'Dinner' });
	await expect(dinner).toContainText('278'); // 450 g ÷ 300 g × 185 kcal

	// Editing the recipe changes future logs only; the diary keeps its snapshot.
	await page.goto('/recipes');
	await page.getByRole('link', { name: new RegExp(`Mercimek çorbası ${tag}`) }).click();
	await page.getByRole('button', { name: new RegExp(`Kuru soğan ${tag}`) }).click();
	await page.getByRole('button', { name: 'Remove from meal' }).click();
	await expect(page.getByRole('region', { name: 'Per serving' })).toContainText('175');
	await page.getByRole('button', { name: 'Save', exact: true }).click();
	await expect(page.getByRole('main')).toContainText('175 kcal per serving');
	await page.goto('/');
	await expect(dinner).toContainText('278');

	// Another member sees the shared recipe as a food with totals, not its ingredients.
	const other = await browser.newContext({ ...testInfo.project.use });
	const otherPage = await other.newPage();
	await signedInAs(otherPage, `Komşu ${tag}`);
	await otherPage.goto('/foods');
	await otherPage.getByLabel('Search foods').fill(`mercimek corbasi ${tag}`);
	await otherPage.getByRole('link', { name: new RegExp(`Mercimek çorbası ${tag}`) }).click();
	await expect(otherPage.getByText('A recipe: values per serving')).toBeVisible();
	await expect(otherPage.getByRole('main')).not.toContainText('mercimek ' + tag);
	await other.close();
});
