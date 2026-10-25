import { expect, test, type Page } from '@playwright/test';
import { apiAs, signedInAs } from './fixtures.ts';

const zone = 'Europe/Istanbul';
const daysAgo = (n: number) => {
	const d = new Date();
	d.setDate(d.getDate() - n);
	return d.toLocaleDateString('en-CA');
};

async function seedSeptember(page: Page) {
	await apiAs(page, 'POST', '/api/v1/targets', {
		mode: 'manual',
		effectiveFrom: '2026-09-01',
		budgetKcal: 2000
	});
	const quick = (date: string, kcal: number) =>
		apiAs(page, 'POST', '/api/v1/diary/entries', {
			kind: 'quick',
			date,
			meal: 'lunch',
			zone,
			kcal,
			description: null
		});
	await quick('2026-09-01', 1800);
	await apiAs(page, 'PUT', '/api/v1/diary/days/2026-09-01', { complete: true });
	await quick('2026-09-02', 2400);
	await quick('2026-09-03', 1500);
}

test('the month calendar colours days by budget and completion', async ({ page }) => {
	await signedInAs(page, 'Ayşe');
	await seedSeptember(page);
	await page.goto('/progress?month=2026-09');
	const calendar = page.getByRole('region', { name: 'September 2026' });
	await expect(
		calendar.getByRole('link', { name: 'Tuesday 1 September: 1800 of 2000 kcal, 200 under' })
	).toBeVisible();
	await expect(
		calendar.getByRole('link', { name: 'Wednesday 2 September: 2400 of 2000 kcal, 400 over' })
	).toBeVisible();
	await expect(
		calendar.getByRole('link', {
			name: 'Thursday 3 September: 1500 of 2000 kcal, not marked complete'
		})
	).toBeVisible();
	await expect(
		calendar.getByRole('link', { name: 'Friday 4 September: nothing logged' })
	).toBeVisible();
	await expect(calendar).toContainText('Under 1 · Over 1 · Not complete 1 · Not logged 27');
	await expect(calendar).toHaveScreenshot('calendar-september.png', { animations: 'disabled' });

	// A day opens in Today.
	await calendar.getByRole('link', { name: /^Wednesday 2 September/ }).click();
	await expect(page.getByRole('heading', { level: 1, name: 'Wed 2 Sep' })).toBeVisible();
});

test('month navigation stops at the current month', async ({ page }) => {
	await signedInAs(page, 'Mehmet');
	await page.goto('/progress');
	await expect(page.getByRole('button', { name: 'Next month' })).toBeDisabled();
	await page.getByRole('button', { name: 'Previous month' }).click();
	await expect(page).toHaveURL(/month=/);
	await expect(page.getByRole('button', { name: 'Next month' })).toBeEnabled();
	await page.goto('/progress?month=2999-01');
	await expect(page.getByRole('button', { name: 'Next month' })).toBeDisabled();
});

test('weight history shows raw readings only', async ({ page }) => {
	await signedInAs(page, 'Zeynep');
	await page.goto('/progress');
	await expect(page.getByText('No weigh-ins in the last 90 days.')).toBeVisible();
	await apiAs(page, 'POST', '/api/v1/body/weight', { date: daysAgo(10), zone, value: 83.1 });
	await apiAs(page, 'POST', '/api/v1/body/weight', { date: daysAgo(3), zone, value: 82.4 });
	await page.reload();
	const weight = page.getByRole('region', { name: 'Weight' });
	await expect(
		weight.getByRole('img', { name: 'Weight over the last 90 days: from 83,1 kg to 82,4 kg' })
	).toBeVisible();
	await expect(weight.getByRole('listitem')).toHaveCount(2);
});
