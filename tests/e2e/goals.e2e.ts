import { expect, test, type Page } from '@playwright/test';
import { apiAs, signedInAs } from './fixtures.ts';

/** A birth date that makes the person exactly `years` old today (birthdays count from the day itself). */
const bornYearsAgo = (years: number) => `${new Date().getFullYear() - years}-01-01`;

async function fillDetails(page: Page, birthDate: string) {
	await page.goto('/onboarding');
	await page.getByLabel('Height (cm)').fill('180');
	await page.getByLabel('Weight (kg)').fill('80');
	await page.getByLabel('Birth date').fill(birthDate);
	await page.getByRole('radio', { name: 'Male', exact: true }).click();
	await page.getByRole('button', { name: 'See my estimate' }).click();
}

test('onboarding calculates a budget; activity and completion update Today', async ({ page }) => {
	await signedInAs(page, 'Mehmet');
	await page.goto('/');
	const budget = page.getByRole('region', { name: 'Budget' });
	await budget.getByRole('link', { name: 'Set up your budget' }).click();

	await fillDetails(page, bornYearsAgo(30));
	await expect(page.getByText('BMI 24,7')).toBeVisible();
	await expect(page.getByText('Healthy weight (WHO adult category)')).toBeVisible();
	await expect(page.getByText("can't tell muscle from fat")).toBeVisible();
	// Mifflin–St Jeor: 10·80 + 6.25·180 − 5·30 + 5 = 1,780; × 1.2 = 2,136.
	await expect(page.getByText('Estimated base burn: 2136 kcal/day')).toBeVisible();
	await page.getByRole('radio', { name: '0,5 kg/week' }).click();
	await expect(page.getByText('Daily budget: 1586 kcal')).toBeVisible();
	await expect(page.getByText('not medical advice').first()).toBeVisible();
	await page.getByRole('button', { name: 'Save my budget' }).click();

	await expect(page.getByRole('heading', { level: 1, name: 'Today' })).toBeVisible();
	await expect(budget).toContainText('1586 kcal');
	await expect(budget).toContainText('2136 base + 0 activity − 550 goal');
	await expect(budget).toContainText('kcal left');
	// Macro targets: protein 1.2 g × 80 kg = 96 g; fat 30 % of 1,586 kcal = 53 g; carbohydrate (1,586 − 384 − 477) / 4 = 181 g.
	const nutrients = page.getByRole('region', { name: 'Nutrients' });
	await expect(nutrients).toContainText('/ 96 g');
	await expect(nutrients).toContainText('/ 53 g');
	await expect(nutrients).toContainText('/ 181 g');

	// Activity is added to the budget.
	await budget.getByRole('button', { name: 'Add activity' }).click();
	const sheet = page.getByRole('dialog', { name: 'Activity' });
	await expect(sheet).toContainText("not a watch's total");
	await sheet.getByLabel('Calories burned (kcal)').fill('300');
	await sheet.getByRole('button', { name: 'Add to budget' }).click();
	await expect(budget).toContainText('1886 kcal');
	await expect(budget).toContainText('2136 base + 300 activity − 550 goal');

	// Marking the day complete is a toggle.
	const complete = page.getByRole('button', { name: 'Mark day complete' });
	await complete.click();
	await expect(page.getByRole('button', { name: 'Day complete' })).toHaveAttribute(
		'aria-pressed',
		'true'
	);
	await page.getByRole('button', { name: 'Day complete' }).click();
	await expect(page.getByRole('button', { name: 'Mark day complete' })).toHaveAttribute(
		'aria-pressed',
		'false'
	);

	// The Profile page shows the target.
	await page.goto('/profile');
	await expect(page.getByText('Calculated: 2136 base − 550 goal, minimum 1500')).toBeVisible();
});

test('under-18s get no calculated target but can enter a professional’s number; over budget shows red', async ({
	page
}) => {
	await signedInAs(page, 'Deniz');
	await fillDetails(page, bornYearsAgo(15));
	await expect(
		page.getByText('Adult BMI categories don’t apply here.'.replace('’', "'"))
	).toBeVisible();
	await expect(page.getByText("doesn't calculate targets")).toBeVisible();
	await expect(page.getByRole('button', { name: 'Save my budget' })).toHaveCount(0);

	await page.getByLabel('Daily budget (kcal)').fill('2000');
	await page.getByRole('button', { name: 'Use this budget' }).click();
	const budget = page.getByRole('region', { name: 'Budget' });
	await expect(budget).toContainText('2000 kcal');
	await expect(budget).toContainText('Your own target');

	const date = await page.evaluate(() => new Date().toLocaleDateString('en-CA'));
	await apiAs(page, 'POST', '/api/v1/diary/entries', {
		kind: 'quick',
		date,
		meal: 'dinner',
		zone: 'Europe/Istanbul',
		kcal: 2500,
		description: 'Feast'
	});
	await page.reload();
	await expect(budget).toContainText('500');
	await expect(budget).toContainText('kcal over');
});
