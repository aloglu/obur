// Screenshots of the provisional screens for the owner's design review (not a test). Runs only when the marker file
// .review-shots exists in the project folder: `touch .review-shots && npm run test:e2e -- review-screens
// --project desktop-chromium`. Phone-sized Chromium (for Speak's fake microphone), light and dark, example data.
import { existsSync, mkdirSync } from 'node:fs';
import { expect, test, type Page } from '@playwright/test';
import { e2eEnv } from '../../playwright.config.ts';
import { apiAs, createFood, signedInAs } from './fixtures.ts';

test.skip(!existsSync('.review-shots'), 'design review screenshots only on request');
test.skip(({ browserName }) => browserName !== 'chromium', 'one browser is enough');
test.use({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });
test.setTimeout(240_000);

const OUT = 'test-results/review';
const ZONE = 'Europe/Istanbul';

async function shot(page: Page, name: string, theme: 'light' | 'dark', full = false) {
	await page.waitForTimeout(450); // sheets finish sliding in
	await page.screenshot({
		path: `${OUT}/${name}-${theme}.jpg`,
		type: 'jpeg',
		quality: 82,
		fullPage: full
	});
}

for (const theme of ['light', 'dark'] as const) {
	test(`review screens (${theme})`, async ({ page, context }) => {
		mkdirSync(OUT, { recursive: true });
		await signedInAs(page, `Ayşe Yılmaz`, 'admin');
		await context.addCookies([
			{ name: 'obur_theme', value: theme, url: e2eEnv.PUBLIC_ORIGIN },
			{ name: 'obur_zone', value: ZONE, url: e2eEnv.PUBLIC_ORIGIN }
		]);
		const today = await page.evaluate(() => new Date().toLocaleDateString('en-CA'));

		// Example data: a calculated budget, foods, a day of entries, water, weigh-ins, activity, a saved meal.
		await apiAs(page, 'PUT', '/api/v1/profile', {
			heightCm: 178,
			birthDate: '1992-04-12',
			sex: 'male'
		});
		await apiAs(page, 'POST', '/api/v1/body/weight', {
			date: today,
			zone: ZONE,
			value: 84.6
		});
		await apiAs(page, 'POST', '/api/v1/targets', {
			mode: 'calculated',
			effectiveFrom: today,
			rateKgPerWeek: 0.5,
			goalWeightKg: 78
		});
		const bread = await createFood(page, {
			name: 'Tam Buğday Ekmeği',
			brand: 'Untad',
			basis: '100g',
			nutrients: [
				{ code: 'energy_kcal', value: 236, qualifier: 'reported' },
				{ code: 'protein', value: 11.2, qualifier: 'reported' },
				{ code: 'carbohydrate_excl_fibre', value: 38.5, qualifier: 'reported' },
				{ code: 'fat', value: 2.1, qualifier: 'reported' },
				{ code: 'fibre', value: 8.4, qualifier: 'reported' }
			],
			servings: [{ name: 'dilim', amount: 28, unit: 'g' }]
		});
		const cheese = await createFood(page, {
			name: 'Light Beyaz Peynir',
			brand: 'Sütaş',
			basis: '100g',
			nutrients: [
				{ code: 'energy_kcal', value: 196, qualifier: 'reported' },
				{ code: 'protein', value: 17, qualifier: 'reported' },
				{ code: 'carbohydrate_unspecified', value: 1.2, qualifier: 'reported' },
				{ code: 'fat', value: 13.5, qualifier: 'reported' }
			],
			servings: []
		});
		const entry = (foodId: string, amount: number, unit: unknown, meal: string) =>
			apiAs<{ id: string }>(page, 'POST', '/api/v1/diary/entries', {
				kind: 'food',
				date: today,
				meal,
				zone: ZONE,
				foodId,
				amount,
				unit
			});
		const food = await apiAs<{ servings: { id: string }[] }>(page, 'GET', `/api/v1/foods/${bread}`);
		const e1 = await entry(
			bread,
			2,
			{ kind: 'serving', servingId: food.servings[0].id },
			'breakfast'
		);
		const e2 = await entry(cheese, 60, { kind: 'mass', unit: 'g' }, 'breakfast');
		await apiAs(page, 'POST', '/api/v1/saved-meals', {
			name: 'Hafta içi kahvaltı',
			entryIds: [e1.id, e2.id]
		});
		for (const ml of [250, 500, 250])
			await apiAs(page, 'POST', '/api/v1/body/water', { date: today, zone: ZONE, value: ml });
		await apiAs(page, 'POST', '/api/v1/body/activity', {
			date: today,
			zone: ZONE,
			value: 420,
			kind: 'day_total'
		});

		// Today, for context.
		await page.goto('/');
		await expect(page.getByRole('region', { name: 'Budget' })).toContainText('kcal');
		await shot(page, '01-today', theme, true);

		// Profile with the budget settings.
		await page.goto('/profile');
		await shot(page, '02-profile', theme, true);

		// Onboarding: details, then the estimate.
		await page.goto('/onboarding');
		await shot(page, '03-onboarding', theme, true);

		// Water and weigh-ins editing, and the activity sheet.
		await page.goto('/');
		await page
			.getByRole('region', { name: 'Water' })
			.getByRole('button', { name: 'Edit or delete water' })
			.click();
		await shot(page, '04-water-edit', theme);
		await page.getByRole('dialog').getByRole('button', { name: 'Close' }).click();
		await page
			.getByRole('region', { name: 'Weight' })
			.getByRole('button', { name: 'Edit or delete weigh-ins' })
			.click();
		await shot(page, '05-weight-edit', theme);
		await page.getByRole('dialog').getByRole('button', { name: 'Close' }).click();
		await page
			.getByRole('region', { name: 'Budget' })
			.getByRole('button', { name: 'Add activity' })
			.click();
		await shot(page, '06-activity', theme);
		await page.getByRole('dialog').getByRole('button', { name: 'Close' }).click();

		// Saved meals: save from a meal card, the sheet to log or manage, the list.
		await page
			.getByRole('region', { name: 'Breakfast' })
			.getByRole('button', { name: 'Save Breakfast as a meal' })
			.click();
		await shot(page, '07-save-meal', theme);
		await page.getByRole('dialog').getByRole('button', { name: 'Close' }).click();
		await page.goto('/saved-meals');
		await shot(page, '08-saved-meals', theme);
		await page.getByRole('button', { name: /Hafta içi kahvaltı/ }).click();
		await expect(page.getByRole('dialog')).toContainText('Manage');
		await shot(page, '09-saved-meal-sheet', theme);

		// Typed entry and Speak.
		await page.goto('/log');
		await page.getByRole('button', { name: 'Type it' }).click();
		await page
			.getByRole('dialog')
			.getByLabel('You typed')
			.fill('kahvaltıda iki dilim untad ekmek, 60 gram beyaz peynir ve iki bardak su');
		await expect(page.getByRole('dialog', { name: 'Type what you ate' })).toContainText('kcal');
		await shot(page, '10-check-and-log', theme);
		await page.getByRole('dialog').getByRole('button', { name: 'Close' }).click();
		await page.getByRole('button', { name: 'Cancel' }).click();
		await context.grantPermissions(['microphone']);
		await page.getByRole('button', { name: 'Speak' }).click();
		await expect(page.getByRole('dialog', { name: 'Speak' })).toContainText('Listening');
		await shot(page, '11-speak', theme);
		await page.getByRole('dialog').getByRole('button', { name: 'Close' }).click();

		// The amount sheet with the new preview.
		await page.getByRole('searchbox').fill('light beyaz');
		await page
			.getByRole('button', { name: /Sütaş Light Beyaz Peynir/ })
			.first()
			.click();
		await page.getByRole('dialog').getByLabel('Amount').fill('60');
		await shot(page, '12-amount', theme);
		await page.getByRole('dialog').getByRole('button', { name: 'Close' }).click();

		// Foods: create, edit own, and a USDA food (read-only).
		await page.goto('/foods/new');
		await shot(page, '13-food-new', theme, true);
		await page.goto(`/foods/${bread}`);
		await shot(page, '14-food-edit', theme, true);
		await page.goto('/foods');
		await page.getByLabel('Search foods').fill('banana');
		await page.getByRole('link', { name: /^Banana/ }).click();
		await expect(page.getByText('USDA FoodData Central')).toBeVisible();
		await shot(page, '15-food-usda', theme, true);

		// Your data and Household.
		await page.goto('/settings/data');
		await shot(page, '16-your-data', theme, true);
		await page.goto('/household');
		await shot(page, '17-household', theme, true);
	});
}
