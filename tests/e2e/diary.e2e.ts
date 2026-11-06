import { expect, test, type Page } from '@playwright/test';
import { apiAs, createFood, signedInAs, choose } from './fixtures.ts';

const bread = (tag: string) => ({
	name: `Premium Light Ekmek ${tag}`,
	brand: 'Untad',
	basis: '100g',
	nutrients: [
		{ code: 'energy_kcal', value: 193, qualifier: 'reported' },
		{ code: 'protein', value: 12.9, qualifier: 'reported' },
		{ code: 'carbohydrate_excl_fibre', value: 42.4, qualifier: 'reported' },
		{ code: 'fat', value: 0.2, qualifier: 'reported' },
		{ code: 'fibre', value: 15, qualifier: 'reported' }
	],
	servings: [{ name: 'slice', amount: 26, unit: 'g' }]
});

const isPhone = (page: Page) => (page.viewportSize()?.width ?? 1000) < 760;
const meal = (page: Page, name: string) => page.getByRole('region', { name });

async function openLogFor(page: Page, mealName: string) {
	await meal(page, mealName)
		.getByRole('button', { name: `Add to ${mealName}` })
		.click();
	await expect(page).toHaveURL(/\/log\?meal=/);
	await expect(page.getByText(`Adding to ${mealName} · Today`)).toBeVisible();
}

test('logging, correcting, moving and deleting an entry', async ({ page }, testInfo) => {
	const tag = testInfo.project.name;
	await signedInAs(page, 'Ayşe');
	await createFood(page, bread(tag));
	await page.goto('/');
	await expect(page.getByRole('heading', { level: 1, name: 'Today' })).toBeVisible();
	await expect(page.getByRole('button', { name: 'Next day' })).toBeDisabled();

	// Log three slices to lunch.
	await openLogFor(page, 'Lunch');
	await page.getByRole('searchbox').fill(`untad ${tag}`);
	await page.getByRole('button', { name: new RegExp(`Untad Premium Light Ekmek ${tag}`) }).click();
	const sheet = page.getByRole('dialog');
	await expect(sheet.getByText('193 kcal per 100 g')).toBeVisible();
	await expect(sheet.getByRole('button', { name: /^Unit: slice \(26 g\)/ })).toBeVisible();
	await sheet.getByLabel('Amount').fill('3');
	await expect(sheet.getByText('151 kcal')).toBeVisible();
	await sheet.getByRole('button', { name: 'Save' }).click();

	const lunch = meal(page, 'Lunch');
	await expect(lunch.getByText('3 × slice (26 g)')).toBeVisible();
	await expect(page.getByRole('status').getByText('Logged to Lunch · 151 kcal')).toBeVisible();

	// Undo from the toast removes it again.
	await page.getByRole('status').getByRole('button', { name: 'Undo' }).click();
	await expect(lunch.getByRole('listitem')).toHaveCount(0);

	// Log it again, then correct the amount from the entry's own snapshot.
	await openLogFor(page, 'Lunch');
	await page.getByRole('searchbox').fill(`untad ${tag}`);
	await page.getByRole('button', { name: new RegExp(`Untad Premium Light Ekmek ${tag}`) }).click();
	await page.getByRole('dialog').getByRole('button', { name: 'Save' }).click();
	await expect(lunch.getByText('1 × slice (26 g)')).toBeVisible();

	// Now it is a recent food: focusing the empty search field suggests it.
	await openLogFor(page, 'Snacks');
	await page.getByRole('searchbox').click();
	const recent = page.getByRole('region', { name: 'Recent' });
	await expect(
		recent.getByRole('button', { name: new RegExp(`Untad Premium Light Ekmek ${tag}`) })
	).toBeVisible();
	await page.getByRole('button', { name: 'Cancel' }).click();
	await page.goto('/');
	await lunch.getByRole('button', { name: /Untad Premium Light Ekmek/ }).click();
	await page.getByRole('dialog').getByLabel('Amount').fill('2');
	await page.getByRole('dialog').getByRole('button', { name: 'Save changes' }).click();
	await expect(lunch.getByText('2 × slice (26 g)')).toBeVisible();
	await expect(lunch.getByRole('button', { name: /Untad/ })).toContainText('100');

	// Move to dinner, through the menu.
	await lunch.getByRole('button', { name: /Untad Premium Light Ekmek/ }).click();
	await page.getByRole('dialog').getByRole('button', { name: 'Move to…' }).click();
	await expect(
		page.getByRole('dialog').getByRole('button', { name: 'Lunch (current)' })
	).toBeDisabled();
	await page.getByRole('dialog').getByRole('button', { name: 'Dinner' }).click();
	await expect(meal(page, 'Dinner').getByText('2 × slice (26 g)')).toBeVisible();
	await expect(page.getByRole('status').getByText('Moved to Dinner')).toBeVisible();

	// Delete with Undo, no confirmation dialog.
	await meal(page, 'Dinner').getByRole('button', { name: /Untad/ }).click();
	await page.getByRole('dialog').getByRole('button', { name: 'Delete' }).click();
	await expect(meal(page, 'Dinner').getByRole('listitem')).toHaveCount(0);
	await page.getByRole('status').getByRole('button', { name: 'Undo' }).click();
	await expect(meal(page, 'Dinner').getByText('2 × slice (26 g)')).toBeVisible();
});

test('a quick add records calories only and makes totals partial', async ({ page }) => {
	await signedInAs(page, 'Mehmet');
	await page.goto('/');
	await openLogFor(page, 'Snacks');
	await page.getByRole('button', { name: 'Quick add calories' }).click();
	const sheet = page.getByRole('dialog', { name: 'Quick add calories' });
	await sheet.getByLabel('Calories (kcal)').fill('300');
	await sheet.getByLabel('What was it? (optional)').fill('Simit');
	await sheet.getByRole('button', { name: 'Save' }).click();
	const snacks = meal(page, 'Snacks');
	await expect(snacks.getByText('Simit')).toBeVisible();
	await expect(snacks.getByText('Macros unknown')).toBeVisible();
	const nutrients = page.getByRole('region', { name: 'Nutrients' });
	// Only calories are known: every other nutrient is unknown, never shown as zero.
	await expect(nutrients.getByText('Unknown').first()).toBeVisible();
	await expect(nutrients).not.toContainText('0 g');
	await expect(page.getByRole('region', { name: 'Budget' })).toContainText('300');
});

test('the day header moves between days and never into the future', async ({ page }) => {
	await signedInAs(page, 'Zeynep');
	await page.goto('/');
	await page.getByRole('button', { name: 'Previous day' }).click();
	await expect(page.getByRole('heading', { level: 1, name: 'Yesterday' })).toBeVisible();
	await page.getByRole('button', { name: 'Next day' }).click();
	await expect(page.getByRole('heading', { level: 1, name: 'Today' })).toBeVisible();
	await page.goto('/?date=2999-01-01');
	await expect(page.getByRole('heading', { level: 1, name: 'Today' })).toBeVisible();
});

// Visual comparisons on a fixed past day with long Turkish names (CLAUDE.md, "Verification and handoff").
for (const theme of ['light', 'dark'] as const) {
	test(`Today screen (${theme})`, async ({ page, context }, testInfo) => {
		await signedInAs(page, `Ayşe Yılmaz ${testInfo.project.name} ${theme}`);
		await context.addCookies([{ name: 'obur_theme', value: theme, url: 'http://localhost:4173' }]);
		const bar = await createFood(page, {
			name: 'HighPro+ Çikolatalı Kaplamalı Hindistan Cevizli Protein Bar',
			brand: 'Fellas',
			basis: 'serving',
			servingLabel: '1 bar',
			servingSize: { amount: 50, unit: 'g' },
			nutrients: [
				{ code: 'energy_kcal', value: 191, qualifier: 'reported' },
				{ code: 'protein', value: 20, qualifier: 'reported' },
				{ code: 'fat', value: 8.1, qualifier: 'reported' }
			]
		});
		const sote = await createFood(page, {
			name: 'Pratik Sebze Sote Mix',
			brand: 'Superfresh',
			basis: '100g',
			nutrients: [
				{ code: 'energy_kcal', value: 45, qualifier: 'reported' },
				{ code: 'protein', value: 2, qualifier: 'reported' },
				{ code: 'carbohydrate_excl_fibre', value: 6, qualifier: 'reported' },
				{ code: 'fat', value: 0.4, qualifier: 'reported' },
				{ code: 'fibre', value: 3, qualifier: 'reported' }
			]
		});
		const date = '2026-10-20';
		const base = { date, zone: 'Europe/Istanbul' };
		await apiAs(page, 'POST', '/api/v1/diary/entries', {
			...base,
			kind: 'food',
			meal: 'breakfast',
			foodId: bar,
			amount: 1,
			unit: { kind: 'basis_serving' }
		});
		await apiAs(page, 'POST', '/api/v1/diary/entries', {
			...base,
			kind: 'food',
			meal: 'dinner',
			foodId: sote,
			amount: 225,
			unit: { kind: 'mass', unit: 'g' }
		});
		await apiAs(page, 'POST', '/api/v1/diary/entries', {
			...base,
			kind: 'quick',
			meal: 'snacks',
			kcal: 300,
			description: 'Simit'
		});

		await page.goto(`/?date=${date}`);
		await expect(page.getByRole('heading', { level: 1, name: /^20 October/ })).toBeVisible();
		await page.evaluate(() => document.fonts.ready);
		// Phones: the viewport, where the floating tab bar belongs. Desktop: the whole page.
		await expect(page).toHaveScreenshot(`today-${theme}.png`, {
			fullPage: !isPhone(page),
			animations: 'disabled'
		});
	});
}

test('a theme chosen in More sticks and repaints the page', async ({ page }, testInfo) => {
	await signedInAs(page, `Tema ${testInfo.project.name}`);
	await page.goto('/more/appearance');
	const background = () =>
		page.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue('--bg').trim());
	expect(await background()).toBe('#f6f3ee');

	await page.getByRole('radio', { name: 'Kaset' }).click();
	await expect(page.getByRole('radio', { name: 'Kaset' })).toBeChecked();
	expect(await background()).toBe('#6fe3d6');

	// The server renders it on the next visit, so there is no flash of the default.
	await page.reload();
	await expect(page.locator('html')).toHaveAttribute('data-palette', 'kaset');

	await page.getByRole('radio', { name: 'Pazar' }).click();
	await expect(page.locator('html')).not.toHaveAttribute('data-palette');
});

test('a field menu opens where it fits, and closes with its choice made', async ({
	page
}, testInfo) => {
	await signedInAs(page, `Menü ${testInfo.project.name}`);
	await page.goto('/log');
	await page.getByRole('button', { name: /Quick add/ }).click();
	const sheet = page.getByRole('dialog');
	await sheet.getByRole('button', { name: /^Meal:/ }).click();
	for (const meal of ['Breakfast', 'Lunch', 'Dinner', 'Snacks']) {
		await expect(sheet.getByRole('option', { name: meal })).toBeInViewport({ ratio: 1 });
	}
	await sheet.getByRole('option', { name: 'Snacks' }).click();
	await expect(sheet.getByRole('button', { name: 'Meal: Snacks' })).toBeFocused();
	await expect(sheet.getByRole('option', { name: 'Snacks' })).toBeHidden();
});

test('More shows its values; Settings links still arrive there', async ({ page }, testInfo) => {
	await signedInAs(page, `Daha ${testInfo.project.name}`);
	await page.goto('/settings');
	await expect(page).toHaveURL(/\/more$/);
	await expect(page.getByRole('link', { name: /Appearance.*Pazar · System/ })).toBeVisible();

	await page.getByRole('link', { name: /Units/ }).click();
	await choose(page, /^Time:/, '12-hour');
	await expect(page.getByRole('button', { name: 'Time: 12-hour' })).toBeVisible();
	await page.getByRole('link', { name: 'More' }).first().click();
	await expect(page.getByRole('link', { name: /Units.*kg · 12-hour/ })).toBeVisible();
});

test('an open sheet holds the page behind it still, and puts it back', async ({
	page
}, testInfo) => {
	await signedInAs(page, `Kaydırma ${testInfo.project.name}`);
	await page.setViewportSize({ width: page.viewportSize()!.width, height: 260 });
	await page.goto('/log');
	await page.waitForLoadState('networkidle');
	await page.evaluate(() => window.scrollTo({ top: 60, behavior: 'instant' }));

	await page.getByRole('button', { name: /Quick add/ }).click();
	const sheet = page.getByRole('dialog');
	await expect(sheet).toBeVisible();
	await expect(page.locator('body')).toHaveCSS('position', 'fixed');
	await expect(sheet).toHaveCSS('overscroll-behavior-y', 'contain');
	// Where the page was when the sheet opened (tapping the button may have scrolled it there).
	const y = await page.evaluate(() => -parseFloat(document.body.style.top));
	expect(y).toBeGreaterThan(0);

	await sheet.getByRole('button', { name: 'Close' }).click();
	await expect(page.locator('body')).not.toHaveCSS('position', 'fixed');
	await expect(page.getByRole('dialog')).toHaveCount(0);
	await expect(page.locator('dialog')).toHaveCount(0);
	expect(await page.evaluate(() => window.scrollY)).toBe(y);
});

test('a sheet reopened while the last one slides away works, and focus returns to its button', async ({
	page
}, testInfo) => {
	await signedInAs(page, `Yeniden ${testInfo.project.name}`);
	await page.goto('/log');
	await page.waitForLoadState('networkidle');
	const open = page.getByRole('button', { name: /Quick add/ });
	await open.click();
	await page.getByRole('dialog').getByRole('button', { name: 'Close' }).click();
	await expect(open).toBeFocused();
	await expect(open).toHaveCSS('outline-style', 'none'); // no ring after a tap
	await open.click();
	await page.getByRole('dialog').getByLabel('Calories (kcal)').fill('150');
	await expect(page.getByRole('dialog').getByLabel('Calories (kcal)')).toHaveValue('150');
	await page.keyboard.press('Escape');
	await expect(page.getByRole('dialog')).toHaveCount(0);
	await expect(open).toBeFocused();
});

test('the arrow keys move between days, and leave fields alone', async ({ page }, testInfo) => {
	await signedInAs(page, `Ok ${testInfo.project.name}`);
	await page.goto('/');
	await page.waitForLoadState('networkidle');
	await page.keyboard.press('ArrowRight'); // no further than today
	await expect(page.getByRole('heading', { level: 1, name: 'Today' })).toBeVisible();
	await page.keyboard.press('ArrowLeft');
	await expect(page.getByRole('heading', { level: 1, name: 'Yesterday' })).toBeVisible();
	await page.keyboard.press('ArrowRight');
	await expect(page.getByRole('heading', { level: 1, name: 'Today' })).toBeVisible();

	await page.getByRole('button', { name: 'Other amount' }).click();
	await page.getByLabel('Amount of water').fill('12');
	await page.keyboard.press('ArrowLeft');
	await expect(page.getByRole('heading', { level: 1, name: 'Today' })).toBeVisible();
});

test('a day note saves itself, shows its Markdown, and stays with its day', async ({
	page
}, testInfo) => {
	await signedInAs(page, `Not ${testInfo.project.name}`);
	await page.goto('/');
	await page.waitForLoadState('networkidle');
	const note = page.getByRole('region', { name: 'Notes' });
	await expect(note).toContainText('Add a note for this day');

	// An empty note opens ready to type.
	await note.getByRole('button', { name: /^Notes/ }).click();
	const field = note.getByLabel('Note for this day');
	await expect(field).toBeFocused();
	// The focus ring sits inside the field: the card's opening animation clips anything outside it (owner's report).
	await expect(field).toHaveCSS('outline-offset', '-2px');
	const saved = page.waitForResponse(/\/note$/);
	await field.fill(
		'Lunch at a **friend**, <b>really</b>\n- [ ] Weigh in\n[site](https://example.com)'
	);
	await saved;
	await note.getByRole('button', { name: 'Done' }).click();

	// Shown as Markdown; what looks like HTML stays text.
	await expect(note.locator('b', { hasText: 'friend' })).toBeVisible();
	await expect(note.getByText('<b>really</b>')).toBeVisible();
	await expect(note.getByRole('link', { name: 'site' })).toHaveAttribute('rel', /noopener/);

	// Ticking a to-do changes the note itself.
	const ticked = page.waitForResponse(/\/note$/);
	await note.getByRole('checkbox', { name: 'Weigh in' }).check();
	await ticked;
	await page.reload();
	await expect(note).toContainText('Lunch at a friend');
	await note.getByRole('button', { name: /^Notes/ }).click();
	await expect(note.getByRole('checkbox', { name: 'Weigh in' })).toBeChecked();

	// Another day has its own.
	await page.getByRole('button', { name: 'Previous day' }).click();
	await expect(page.getByRole('heading', { level: 1, name: 'Yesterday' })).toBeVisible();
	await expect(note).toContainText('Add a note for this day');
});
