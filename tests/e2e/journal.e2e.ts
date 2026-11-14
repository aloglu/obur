import { expect, test, type Page } from '@playwright/test';
import { apiAs, signedInAs } from './fixtures.ts';

const zone = 'Europe/Istanbul';

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
	await page.goto('/journal?month=2026-09');
	const calendar = page.getByRole('region', { name: 'September 2026' });
	await expect(
		calendar.getByRole('button', { name: 'Tuesday 1 September: 1800 of 2000 kcal, 200 under' })
	).toBeVisible();
	await expect(
		calendar.getByRole('button', { name: 'Wednesday 2 September: 2400 of 2000 kcal, 400 over' })
	).toBeVisible();
	await expect(
		calendar.getByRole('button', {
			name: 'Thursday 3 September: 1500 of 2000 kcal, not marked complete'
		})
	).toBeVisible();
	await expect(
		calendar.getByRole('button', { name: 'Friday 4 September: nothing logged' })
	).toBeVisible();
	await expect(calendar).toHaveScreenshot('calendar-september.png', { animations: 'disabled' });

	// Tapping a day selects it, without leaving: the box shows it, and Open goes there.
	await calendar.getByRole('button', { name: /^Wednesday 2 September/ }).click();
	await expect(calendar).toContainText('Wednesday 2 Sep');
	await expect(calendar).toContainText('2400 of 2000');
	await expect(calendar).toContainText('400 over');
	await calendar.getByRole('button', { name: /^Friday 4 September/ }).click();
	await expect(calendar).toContainText('Nothing logged');
	await expect(calendar).not.toContainText('of 2000');
	await calendar.getByRole('button', { name: /^Wednesday 2 September/ }).click();
	await calendar.getByRole('link', { name: 'Open' }).click();
	await expect(page.getByRole('heading', { level: 1, name: /^2 September/ })).toBeVisible();
});

test('month navigation stops at the current month', async ({ page }) => {
	await signedInAs(page, 'Mehmet');
	await page.goto('/journal');
	await expect(page.getByRole('button', { name: 'Next month' })).toBeDisabled();
	await page.getByRole('button', { name: 'Previous month' }).click();
	await expect(page).toHaveURL(/month=/);
	await expect(page.getByRole('button', { name: 'Next month' })).toBeEnabled();
	await page.goto('/journal?month=2999-01');
	await expect(page).toHaveURL(/\/journal$/);
	await expect(page.getByRole('button', { name: 'Next month' })).toBeDisabled();
});

test('the highlights follow the calendar’s month', async ({ page }, testInfo) => {
	await signedInAs(page, `Günlük ${testInfo.project.name}`);
	await seedSeptember(page);
	await apiAs(page, 'POST', '/api/v1/body/weight', { date: '2026-08-25', zone, value: 90 });
	await apiAs(page, 'POST', '/api/v1/body/weight', { date: '2026-09-02', zone, value: 89.4 });

	// Reached from the tab bar or the side navigation.
	await page.goto('/');
	await page
		.getByRole('navigation', { name: 'Main' })
		.filter({ visible: true })
		.getByRole('link', { name: 'Journal' })
		.click();
	await expect(page.getByRole('heading', { level: 1, name: 'Journal' })).toBeVisible();

	await page.goto('/journal?month=2026-09');
	await expect(page.getByRole('heading', { name: "September's highlights" })).toBeVisible();
	const week = page.getByRole('article', { name: '1–6 Sep' });
	// Averages only over the complete day; the weight change since the last weigh-in before the week.
	await expect(week).toContainText('1800 kcal a day');
	await expect(week).toContainText('200 under');
	await expect(week).toContainText('−0.6 kg');
	const items = week.getByRole('listitem');
	// The first day logged and first complete day are achievements, and lead their day.
	await expect(items).toHaveText([
		/New lowest weight: 89\.4 kg Wed 2 Sep$/,
		/First day logged Tue 1 Sep$/,
		/First complete day Tue 1 Sep$/,
		/Budget set to 2000 kcal Tue 1 Sep$/
	]);
	// The later weeks of September had nothing recorded.
	await expect(page.getByRole('article')).toHaveCount(1);

	await page.getByRole('button', { name: 'Previous month' }).click();
	await expect(page.getByRole('heading', { name: "August's highlights" })).toBeVisible();
	await expect(page.getByRole('article', { name: '24–30 Aug' })).toContainText(
		'No days marked complete'
	);
});

test('Journal opens on the day you came from, and the month title leads back to today', async ({
	page
}, testInfo) => {
	await signedInAs(page, `Dönüş ${testInfo.project.name}`);
	await page.goto('/?date=2026-09-02');
	await page
		.getByRole('navigation', { name: 'Main' })
		.filter({ visible: true })
		.getByRole('link', { name: 'Journal' })
		.click();
	const calendar = page.getByRole('region', { name: 'September 2026' });
	await expect(calendar).toBeVisible();
	await expect(calendar.getByRole('button', { name: /^Wednesday 2 September/ })).toHaveAttribute(
		'aria-pressed',
		'true'
	);

	const back = calendar.getByRole('button', { name: /back to today/ });
	await back.click();
	await expect(page.getByRole('region', { name: 'September 2026' })).toHaveCount(0);
	const now = page.locator('section').first();
	await expect(now).toContainText('Today');
	// On today the title is plain and does nothing.
	await expect(page.getByRole('button', { name: /back to today/ })).toHaveCount(0);
	await expect(now.getByRole('heading', { level: 2 })).toBeVisible();
});

test('a day with a weigh-in but no food keeps its columns', async ({ page }, testInfo) => {
	await signedInAs(page, `Tartı ${testInfo.project.name}`);
	await apiAs(page, 'POST', '/api/v1/body/weight', {
		date: '2026-09-05',
		zone: 'UTC',
		value: 82.4
	});
	await page.goto('/journal?day=2026-09-05');
	const calendar = page.getByRole('region', { name: 'September 2026' });
	await expect(calendar).toContainText('82.4 kg');
	await expect(calendar).toContainText('Nothing logged');
});
