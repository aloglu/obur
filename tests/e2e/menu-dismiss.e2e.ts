// Menus (docs/ui.md, "Choices"): a tap outside an open menu only closes it, and archiving a food says so where the
// person is looking (owner reports, 2026-11-16).
import { expect, test } from '@playwright/test';
import { apiAs, createFood, signedInAs } from './fixtures.ts';

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

test('a tap outside an open … menu closes it without pressing what was under it', async ({
	page
}, testInfo) => {
	await signedInAs(page, `Menü ${testInfo.project.name}`);
	await apiAs(page, 'POST', '/api/v1/diary/entries', {
		kind: 'quick',
		date: new Date().toLocaleDateString('en-CA'),
		meal: 'breakfast',
		zone: 'Europe/Istanbul',
		kcal: 280,
		description: 'Toast'
	});
	await page.goto('/');
	await page.getByRole('button', { name: 'Breakfast actions' }).click();
	const menu = page.getByRole('menu', { name: 'Breakfast actions' });
	await expect(menu).toBeVisible();

	// A tap on Lunch's Add food only closes the menu; the next one works.
	const addLunch = page.getByRole('button', { name: /Add food to Lunch/ });
	await addLunch.click();
	await expect(menu).toBeHidden();
	await expect(page).toHaveURL(/\/$|\/\?/);

	await addLunch.click();
	await expect(page).toHaveURL(/\/log/);
});

test("the meal … button's dots end on the calorie numbers' right edge", async ({
	page
}, testInfo) => {
	// Owner, 2026-11-18: the bare dots, lined up with the numbers above them; the tap target stays 44 px.
	await signedInAs(page, `Noktalar ${testInfo.project.name}`);
	await apiAs(page, 'POST', '/api/v1/diary/entries', {
		kind: 'quick',
		date: new Date().toLocaleDateString('en-CA'),
		meal: 'breakfast',
		zone: 'Europe/Istanbul',
		kcal: 280,
		description: 'Toast'
	});
	await page.goto('/');
	const button = page.getByRole('button', { name: 'Breakfast actions' });
	await expect(button).toBeVisible();
	const box = await button.boundingBox();
	expect(box?.width).toBeGreaterThanOrEqual(44);
	expect(box?.height).toBeGreaterThanOrEqual(44);
	const dotsRight = await button.evaluate((b) =>
		Math.max(...[...b.querySelectorAll('svg circle')].map((c) => c.getBoundingClientRect().right))
	);
	const numberRight = await page
		.getByRole('button', { name: /Toast/ })
		.getByText('280', { exact: true })
		.evaluate((el) => {
			const range = document.createRange();
			range.selectNodeContents(el);
			return range.getBoundingClientRect().right;
		});
	expect(Math.abs(dotsRight - numberRight)).toBeLessThanOrEqual(1.5);
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
	// It leaves the list; the archive opens from the row under New food.
	await expect(page.getByRole('link', { name: /Archive test bar/ })).toHaveCount(0);
	await expect(page.getByRole('link', { name: /Archived foods\s*1/ })).toBeVisible();

	await toast.getByRole('button', { name: 'Undo' }).click();
	await expect(page).toHaveURL(new RegExp(`/foods/${id}$`));
	await expect(page.getByRole('button', { name: 'Archive food' })).toBeVisible();

	await page.getByRole('button', { name: 'Archive food' }).click();
	await page.getByRole('link', { name: /Archived foods/ }).click();
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

test("Cancel on a food's page leaves without saving, back to where the page came from", async ({
	page
}) => {
	// Owner, 2026-11-18: a food's page ends like the recipe and saved meal editors, Cancel beside Save food.
	await signedInAs(page, 'Vazgeçen');
	const id = await createFood(page, {
		name: 'Cancel test bar',
		basis: '100g',
		nutrients: [{ code: 'energy_kcal', value: 400, qualifier: 'reported' }]
	});
	await page.goto(`/foods/${id}`);
	await page.getByLabel('Name', { exact: true }).fill('Changed name');
	await page.getByRole('link', { name: 'Cancel' }).click();
	await expect(page).toHaveURL(/\/foods$/);
	await expect(page.getByRole('link', { name: /Cancel test bar/ })).toBeVisible();

	await page.goto(`/foods/${id}`);
	await page.getByRole('button', { name: 'Archive food' }).click();
	await expect(page.getByRole('status').filter({ hasText: 'Food archived' })).toBeVisible();
	await page.goto(`/foods/${id}`);
	await expect(page.getByRole('button', { name: 'Restore' })).toBeVisible();
	await page.getByRole('link', { name: 'Cancel' }).click();
	await expect(page).toHaveURL(/\/foods\/archived$/);
});
