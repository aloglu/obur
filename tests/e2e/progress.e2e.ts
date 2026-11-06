import { expect, test } from '@playwright/test';
import { apiAs, createFood, signedInAs } from './fixtures.ts';

const zone = 'Europe/Istanbul';
const daysAgo = (n: number) => {
	const d = new Date();
	d.setDate(d.getDate() - n);
	return d.toLocaleDateString('en-CA');
};

test('an old Progress link with a month opens the Journal', async ({ page }) => {
	await signedInAs(page, 'Mehmet');
	await page.goto('/progress?month=2026-09');
	await expect(page).toHaveURL(/\/journal\?month=2026-09/);
	await expect(page.getByRole('region', { name: 'September 2026' })).toBeVisible();
});

test('history: weigh-ins and their trend, calories against budget, averages over complete days only', async ({
	page
}, testInfo) => {
	await signedInAs(page, `Geçmiş ${testInfo.project.name}`);
	await page.goto('/progress');
	await expect(page.getByText('Your weight line starts with your first weigh-in.')).toBeVisible();
	// Seed away from the app, so its periodic refresh can't race the navigation below.
	await page.goto('about:blank');
	await apiAs(page, 'POST', '/api/v1/targets', {
		mode: 'manual',
		effectiveFrom: daysAgo(40),
		budgetKcal: 2000
	});
	for (const [n, kg] of [
		[20, 84.0],
		[12, 83.6],
		[6, 83.1],
		[3, 82.4],
		[0, 82.6]
	] as const)
		await apiAs(page, 'POST', '/api/v1/body/weight', { date: daysAgo(n), zone, value: kg });
	const quick = (n: number, kcal: number) =>
		apiAs(page, 'POST', '/api/v1/diary/entries', {
			kind: 'quick',
			date: daysAgo(n),
			meal: 'lunch',
			zone,
			kcal,
			description: null
		});
	const complete = (n: number) =>
		apiAs(page, 'PUT', `/api/v1/diary/days/${daysAgo(n)}`, { complete: true });
	const foodId = await createFood(page, {
		name: `Müsli geçmiş ${testInfo.project.name}`,
		basis: '100g',
		nutrients: [
			{ code: 'energy_kcal', value: 1800, qualifier: 'reported' },
			{ code: 'protein', value: 100, qualifier: 'reported' },
			{ code: 'carbohydrate_excl_fibre', value: 200, qualifier: 'reported' },
			{ code: 'fat', value: 60, qualifier: 'reported' }
		]
	});
	// Two complete days: one from a food with macros (1800 kcal), one a quick add over budget (2300 kcal).
	await apiAs(page, 'POST', '/api/v1/diary/entries', {
		kind: 'food',
		date: daysAgo(2),
		meal: 'lunch',
		zone,
		foodId,
		amount: 100,
		unit: { kind: 'mass', unit: 'g' }
	});
	await complete(2);
	await quick(1, 2300);
	await complete(1);
	// Not marked complete: shown, but left out of the averages however low.
	await quick(4, 900);

	await page.goto('/progress?range=1M');
	const tab = (name: string) => page.getByRole('tab', { name });
	await expect(tab('Weight')).toHaveAttribute('aria-selected', 'true');

	// One card, whichever tab is open.
	const weight = page.getByRole('tabpanel');
	// Readings: what was weighed. The label above the weight is the switch: both names, the one shown checked.
	const show = weight.getByRole('radiogroup', { name: 'Show' });
	await expect(show.getByRole('radio', { name: 'Latest weigh-in' })).toHaveAttribute(
		'aria-checked',
		'true'
	);
	await expect(weight).toContainText(/82,6\s*kg/);
	await expect(weight).toContainText('−1,4 kg');
	await expect(weight.getByText('Average change per week')).toBeVisible();
	await expect(weight).toContainText(/Average change per week\s*−0,5 kg/);
	await expect(weight).toContainText('Weigh-ins5');
	const weightReadout = weight.locator('[aria-live="polite"]');
	await expect(weightReadout).toContainText(': 82,6 kg');
	await weight.getByRole('slider', { name: 'Weight' }).focus();
	await page.keyboard.press('ArrowLeft');
	await expect(weightReadout).toContainText(': 82,4 kg');
	// Looking at a weigh-in turns the headline into it, and leaving goes back to the latest.
	await expect(weight.locator('p').filter({ hasText: /^82,4\s*kg$/ })).toBeVisible();
	await expect(weight).not.toContainText('−1,4 kg');
	await page.locator('h1').click();
	await expect(weight).toContainText('−1,4 kg');
	await expect(weightReadout).toContainText(': 82,6 kg');
	// Trend: the smoothed weight and pace, remembered on this device; the card keeps its height.
	const before = (await weight.boundingBox())!.height;
	await show.getByRole('radio', { name: 'Smoothed' }).click();
	await expect(show.getByRole('radio', { name: 'Smoothed' })).toHaveAttribute(
		'aria-checked',
		'true'
	);
	await expect(weight).toContainText(/kg a week/);
	await expect(weightReadout).toContainText('smoothed');
	await expect(weightReadout).toContainText('weighed 82,6 kg');
	expect((await weight.boundingBox())!.height).toBeCloseTo(before, 1);
	await page.reload();
	await expect(page.getByRole('radio', { name: 'Smoothed' })).toHaveAttribute(
		'aria-checked',
		'true'
	);
	await page.getByRole('radio', { name: 'Latest weigh-in' }).click();

	await tab('Calories').click();
	const calories = page.getByRole('tabpanel');
	await expect(calories.getByText('Days under budget')).toBeVisible();
	await expect(calories).toContainText(/2050\s*kcal/);
	await expect(calories).toContainText('50 over budget on 2 complete days');
	const caloriesReadout = calories.locator('[aria-live="polite"]');
	await expect(caloriesReadout).toContainText('nothing logged');
	await calories.getByRole('slider', { name: 'Calories' }).focus();
	await page.keyboard.press('ArrowLeft');
	await expect(caloriesReadout).toContainText('2300 of 2000 kcal, 300 over');
	await expect(calories).toContainText('of 2000 · 300 over');
	await page.keyboard.press('ArrowLeft');
	await page.keyboard.press('ArrowLeft');
	await page.keyboard.press('ArrowLeft');
	await expect(caloriesReadout).toContainText('900 of 2000 kcal, 1100 under · not marked complete');

	await tab('Nutrients').click();
	const nutrients = page.getByRole('tabpanel');
	await expect(nutrients.getByText('Protein', { exact: true })).toBeVisible();
	await expect(nutrients).toContainText('100 g');
	// The over-budget day was a calories-only quick add: its macros are unknown, never zero.
	await expect(nutrients).toContainText('Protein, carbs, fat from 1 of 2 days');

	await page.getByLabel('Range').selectOption('1W');
	await expect(page).toHaveURL(/range=1W/);
	await tab('Weight').click();
	await expect(page.getByText('Weigh-ins3').filter({ visible: true })).toHaveCount(1);
});
