// Menus (docs/ui.md, "Choices"): a tap outside an open menu only closes it, and archiving a food says so where the
// person is looking (owner reports, 2026-11-16).
import { expect, test } from '@playwright/test';
import { createFood, signedInAs } from './fixtures.ts';

test('a tap outside an open menu closes it without pressing what was under it', async ({
	page
}) => {
	await signedInAs(page, 'Menu Kapatan');
	await page.goto('/more/settings');
	await page.getByRole('button', { name: /^Language:/ }).click();
	const menu = page.getByRole('listbox', { name: 'Language' });
	await expect(menu).toBeVisible();

	await page.getByRole('link', { name: /^Units/ }).click();
	await expect(menu).toBeHidden();
	await expect(page).toHaveURL(/\/more\/settings$/);

	// The next tap works as usual.
	await page.getByRole('link', { name: /^Units/ }).click();
	await expect(page).toHaveURL(/\/more\/units$/);
});

test('archiving a food returns to Foods with Undo', async ({ page }) => {
	await signedInAs(page, 'Arşivleyen');
	const id = await createFood(page, {
		name: 'Archive test bar',
		basis: '100g',
		nutrients: [{ code: 'energy_kcal', value: 400, qualifier: 'reported' }]
	});
	await page.goto(`/foods/${id}`);
	await page.getByRole('button', { name: 'Archive food' }).click();
	await expect(page).toHaveURL(/\/foods$/);
	const toast = page.getByRole('status').filter({ hasText: 'Food archived' });
	await expect(toast).toBeVisible();
	await expect(page.getByRole('link', { name: /Archive test bar.*Archived/ })).toBeVisible();

	await toast.getByRole('button', { name: 'Undo' }).click();
	await expect(page).toHaveURL(new RegExp(`/foods/${id}$`));
	await expect(page.getByRole('button', { name: 'Archive food' })).toBeVisible();

	await page.getByRole('button', { name: 'Archive food' }).click();
	await page.getByRole('link', { name: /Archive test bar/ }).click();
	await expect(page.getByText('It no longer appears in search;', { exact: false })).toBeVisible();
	await page.getByRole('button', { name: 'Restore' }).click();
	await expect(page.getByRole('status').filter({ hasText: 'Food restored' })).toBeVisible();
	await expect(page.getByRole('button', { name: 'Archive food' })).toBeVisible();
});

test('the unit menu keeps every option on one line, at most 288 px wide, with the size always shown', async ({
	page
}, testInfo) => {
	await signedInAs(page, `Birim ${testInfo.project.name}`);
	await page.goto('/log');
	await page.getByRole('searchbox').fill('apple');
	await page.getByRole('button', { name: /^Apple, with skin/ }).click();
	await page.getByRole('button', { name: /^Unit:/ }).click();
	const menu = page.getByRole('listbox', { name: 'Unit' });
	const long = menu.getByRole('option', { name: 'US cup (237 ml), quartered or chopped (125 g)' });
	await expect(long).toBeVisible();
	await expect(long.getByText('125 g', { exact: true })).toBeVisible();
	expect((await menu.boundingBox())!.width).toBeLessThanOrEqual(288);
	for (const box of await menu
		.getByRole('option')
		.evaluateAll((els) => els.map((e) => e.getBoundingClientRect().height)))
		expect(box).toBeLessThan(50);
});
