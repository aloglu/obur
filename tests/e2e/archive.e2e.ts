// Archived and deleted foods (docs/ui.md, "Archived and deleted"): the archive has its own page, opened from the top
// of Foods; several foods are restored or deleted at once, Select all takes the whole archive, every step has Undo,
// and deleted foods wait in Recently deleted, grouped, until restored.
import { expect, test } from '@playwright/test';
import { apiAs, createFood, signedInAs } from './fixtures.ts';

const kcal = (value: number) => [{ code: 'energy_kcal', value, qualifier: 'reported' }];

async function archivedFoods(page: import('@playwright/test').Page, names: string[]) {
	const ids: string[] = [];
	for (const name of names)
		ids.push(await createFood(page, { name, basis: '100g', nutrients: kcal(100) }));
	await apiAs(page, 'POST', '/api/v1/foods/bulk', { action: 'archive', ids });
	return ids;
}

test('archived foods have their own page; several are deleted at once, undone, and restored from Recently deleted', async ({
	page
}) => {
	await signedInAs(page, 'Archive Keeper');
	await createFood(page, { name: 'Still used oats', basis: '100g', nutrients: kcal(380) });
	await archivedFoods(page, ['Old protein bar', 'Old iced latte', 'Old pizza slice']);

	await page.goto('/foods');
	const main = page.getByRole('main');
	await expect(main.getByRole('link', { name: /Still used oats/ })).toBeVisible();
	await expect(main.getByRole('link', { name: /Old protein bar/ })).toHaveCount(0);
	await main.getByRole('link', { name: /Archived foods\s*3/ }).click();
	await expect(page).toHaveURL(/\/foods\/archived$/);

	// Search inside the archive.
	await page.getByRole('searchbox', { name: 'Search archived foods' }).fill('latte');
	await expect(main.getByRole('link', { name: /Old iced latte/ })).toBeVisible();
	await expect(main.getByRole('link', { name: /Old protein bar/ })).toHaveCount(0);
	await page.getByRole('searchbox', { name: 'Search archived foods' }).fill('');
	await expect(main.getByRole('link', { name: /Old protein bar/ })).toBeVisible();

	// Select two, delete them: no question, a toast with Undo.
	await main.getByRole('button', { name: 'Select', exact: true }).click();
	await main.getByRole('button', { name: /Old protein bar/ }).click();
	await main.getByRole('button', { name: /Old iced latte/ }).click();
	const bar = page.getByRole('toolbar', { name: 'Selected items' });
	await expect(bar).toContainText('2 selected');
	await bar.getByRole('button', { name: 'Delete' }).click();
	const toast = page.getByRole('status');
	await expect(toast).toContainText('Deleted 2 foods');
	await expect(toast).toContainText('In Recently deleted for 30 days.');
	await expect(main.getByRole('button', { name: /Old pizza slice|Old protein bar/ })).toHaveCount(
		0
	);
	await expect(main.getByRole('link', { name: /Old protein bar/ })).toHaveCount(0);
	await toast.getByRole('button', { name: 'Undo' }).click();
	await expect(main.getByRole('link', { name: /Old protein bar/ })).toBeVisible();

	// Select all, delete everything archived.
	await main.getByRole('button', { name: 'Select', exact: true }).click();
	await main.getByRole('button', { name: 'Select all' }).click();
	await expect(bar).toContainText('3 selected');
	await bar.getByRole('button', { name: 'Delete' }).click();
	await expect(page.getByRole('status')).toContainText('Deleted 3 foods');
	await expect(main).toContainText('No archived foods.');

	// Recently deleted: a Foods group; restore one, then the others together.
	// The step before may still be refreshing the page's data; let it finish first.
	await page.waitForLoadState('networkidle');
	await page.goto('/more/deleted');
	const foods = main.getByRole('region').or(main.locator('section')).filter({ hasText: 'Foods' });
	await expect(foods).toContainText('Old protein bar');
	await expect(foods).toContainText('30 days left');
	await page.getByRole('button', { name: 'Restore Old protein bar' }).click();
	await expect(page.getByRole('status')).toContainText('Restored “Old protein bar”');
	await expect(page.getByRole('status')).toContainText('Back in Archived foods.');
	await foods.getByRole('button', { name: 'Select', exact: true }).click();
	await foods.getByRole('button', { name: 'Select all' }).click();
	await page
		.getByRole('toolbar', { name: 'Selected items' })
		.getByRole('button', { name: 'Restore' })
		.click();
	await expect(page.getByRole('status')).toContainText('Restored 2 foods');
	await expect(main).toContainText('Nothing deleted in the last 30 days.');

	// Back in the archive; one opened shows Restore and Delete food, and its way back leads to the archive.
	// The step before may still be refreshing the page's data; let it finish first.
	await page.waitForLoadState('networkidle');
	await page.goto('/foods/archived');
	await main.getByRole('link', { name: /Old pizza slice/ }).click();
	await expect(page.getByRole('link', { name: 'Archived foods' })).toBeVisible();
	await page.getByRole('button', { name: 'Delete food' }).click();
	await expect(page).toHaveURL(/\/foods\/archived$/);
	await expect(page.getByRole('status')).toContainText('Deleted “Old pizza slice”');
	await page.getByRole('status').getByRole('button', { name: 'Undo' }).click();
	await expect(page.getByRole('button', { name: 'Delete food' })).toBeVisible();
	await page.getByRole('button', { name: 'Restore' }).click();
	await expect(page.getByRole('status')).toContainText('Food restored');
	// A food in use can only be archived.
	await expect(page.getByRole('button', { name: 'Delete food' })).toHaveCount(0);
});

test('deleting a food says the recipe using it keeps its values; archived recipes have their own page', async ({
	page
}) => {
	await signedInAs(page, 'Recipe Keeper');
	const [lentils] = await archivedFoods(page, ['Red lentils']);
	await apiAs(page, 'POST', '/api/v1/foods/bulk', { action: 'restore', ids: [lentils] });
	const recipe = crypto.randomUUID();
	await apiAs(page, 'PUT', `/api/v1/recipes/${recipe}`, {
		version: null,
		name: 'Lentil soup',
		icon: null,
		servings: 4,
		cookedYieldG: null,
		ingredients: [{ foodId: lentils, amount: 200, unit: { kind: 'mass', unit: 'g' } }]
	});
	await apiAs(page, 'POST', '/api/v1/foods/bulk', { action: 'archive', ids: [lentils] });

	// The step before may still be refreshing the page's data; let it finish first.
	await page.waitForLoadState('networkidle');
	await page.goto('/foods/archived');
	const main = page.getByRole('main');
	await main.getByRole('button', { name: 'Select', exact: true }).click();
	await main.getByRole('button', { name: /Red lentils/ }).click();
	await page
		.getByRole('toolbar', { name: 'Selected items' })
		.getByRole('button', { name: 'Delete' })
		.click();
	await expect(page.getByRole('status')).toContainText('Lentil soup keeps its values.');

	// The recipe: archive it from the end of its page (Undo is offered, no question), find it under Archived recipes
	// with the search's placeholder, delete it.
	// The step before may still be refreshing the page's data; let it finish first.
	await page.waitForLoadState('networkidle');
	await page.goto(`/recipes/${recipe}`);
	await expect(page.getByRole('button', { name: 'More actions' })).toHaveCount(0);
	await main.getByRole('button', { name: 'Archive recipe' }).click();
	await expect(page).toHaveURL(/\/recipes$/);
	await expect(page.getByRole('status')).toContainText('Recipe archived');
	await main.getByRole('link', { name: /Archived recipes\s*1/ }).click();
	await expect(main.getByRole('searchbox')).toHaveAttribute('placeholder', /lentil soup/);
	await main.getByRole('link', { name: /Lentil soup/ }).click();
	await main.getByRole('button', { name: 'Restore' }).click();
	await expect(page.getByRole('status')).toContainText('Recipe restored');
	await main.getByRole('button', { name: 'Archive recipe' }).click();
	await expect(page).toHaveURL(/\/recipes$/);
	await main.getByRole('link', { name: /Archived recipes\s*1/ }).click();
	await main.getByRole('link', { name: /Lentil soup/ }).click();
	await main.getByRole('button', { name: 'Delete recipe' }).click();
	await expect(page).toHaveURL(/\/recipes\/archived$/);
	await expect(page.getByRole('status')).toContainText('Deleted “Lentil soup”');
	// The step before may still be refreshing the page's data; let it finish first.
	await page.waitForLoadState('networkidle');
	await page.goto('/more/deleted');
	await expect(main.locator('section').filter({ hasText: 'Recipes' })).toContainText('Lentil soup');
});

test('Select all takes the whole archive, beyond the rows on screen, and Undo brings it all back', async ({
	page
}) => {
	await signedInAs(page, 'Big Importer');
	const names = Array.from(
		{ length: 55 },
		(_, i) => `Imported food ${String(i + 1).padStart(2, '0')}`
	);
	await archivedFoods(page, names);
	// The step before may still be refreshing the page's data; let it finish first.
	await page.waitForLoadState('networkidle');
	await page.goto('/foods/archived');
	const main = page.getByRole('main');
	await expect(main.getByRole('button', { name: 'Show more' })).toBeVisible();
	await main.getByRole('button', { name: 'Select', exact: true }).click();
	await main.getByRole('button', { name: 'Select all' }).click();
	const bar = page.getByRole('toolbar', { name: 'Selected items' });
	await expect(bar).toContainText('55 selected');
	await bar.getByRole('button', { name: 'Delete' }).click();
	await expect(page.getByRole('status')).toContainText('Deleted 55 foods');
	await expect(main).toContainText('No archived foods.');
	await page.getByRole('status').getByRole('button', { name: 'Undo' }).click();
	await expect(main.getByRole('heading', { name: /Archived · 55/ })).toBeVisible();
});
