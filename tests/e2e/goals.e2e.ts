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
	await expect(sheet).toContainText('above an ordinary inactive day');
	await sheet.getByLabel('Calories burned (kcal)').fill('300');
	await sheet.getByRole('button', { name: 'Add to budget' }).click();
	await expect(budget).toContainText('1886 kcal');
	await expect(budget).toContainText('2136 base + 300 activity − 550 goal');

	// Marking the day complete is a switch.
	const complete = page.getByRole('switch', { name: 'Day complete' });
	await expect(complete).toHaveAttribute('aria-checked', 'false');
	await complete.click();
	await expect(complete).toHaveAttribute('aria-checked', 'true');
	await complete.click();
	await expect(complete).toHaveAttribute('aria-checked', 'false');

	// A new weight moves the calculated budget from today on (base 2,136 − 10 × 2 × 1.2 = 2,112); Undo moves it back.
	const weight = page.getByRole('region', { name: 'Weight' });
	await weight.getByLabel('Weight (kg)').fill('78');
	await weight.getByRole('button', { name: 'Save' }).click();
	const toast = page.getByRole('status');
	await expect(toast).toContainText('Saved 78 kg');
	await expect(toast).toContainText('Budget now 1562 kcal (was 1586)');
	await expect(budget).toContainText('2112 base + 300 activity − 550 goal');
	await toast.getByRole('button', { name: 'Undo' }).click();
	await expect(budget).toContainText('2136 base + 300 activity − 550 goal');

	// The Profile page shows the target and says it follows the weight.
	await page.goto('/profile');
	await expect(page.getByText('1586', { exact: true })).toBeVisible();
	for (const value of ['2136 kcal', '− 550 kcal', '1500 kcal'])
		await expect(page.getByRole('definition').filter({ hasText: value })).toBeVisible();
	await expect(page.getByText('Updates from the day you log a new weight.')).toBeVisible();

	// Your details: shown as rows, edited in place; the calculated budget follows from today.
	const details = page.getByRole('region', { name: 'Your details' });
	await expect(details).toContainText('180 cm');
	await expect(details).toContainText('80 kg · Today');
	await details.getByRole('button', { name: 'Edit your details' }).click();
	await details.getByLabel('Height (cm)').fill('20');
	await details.getByRole('button', { name: 'Save details' }).click();
	await expect(details).toContainText('Check the highlighted values');
	// 182 cm and 79 kg: 10·79 + 6.25·182 − 5·30 + 5 = 1,782.5; × 1.2 = 2,139 base.
	await details.getByLabel('Height (cm)').fill('182');
	await details.getByLabel('Weight (kg)').fill('79');
	await details.getByLabel('Goal weight (kg, optional)').fill('74');
	await details.getByRole('button', { name: 'Save details' }).click();
	await expect(page.getByRole('status')).toContainText('Details saved');
	await expect(page.getByRole('status')).toContainText('Budget now 1589 kcal (was 1586)');
	await expect(details).toContainText('182 cm');
	await expect(details).toContainText('79 kg · Today');
	await expect(details).toContainText('74 kg');
	await expect(page.getByRole('definition').filter({ hasText: '2139 kcal' })).toBeVisible();
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

test('day totals replace each other, and the budget settings apply from today', async ({
	page
}) => {
	await signedInAs(page, 'Saat');
	await page.goto('/');
	const budget = page.getByRole('region', { name: 'Budget' });
	await budget.getByRole('link', { name: 'Set up your budget' }).click();
	await fillDetails(page, bornYearsAgo(30));
	await page.getByRole('radio', { name: '0,5 kg/week' }).click();
	await page.getByLabel(/Goal weight/).fill('75');
	await page.getByRole('button', { name: 'Save my budget' }).click();
	await expect(budget).toContainText('2136 base + 0 activity − 550 goal');

	// A day total, then a newer one: the newer replaces it; one activity adds on top.
	const addActivity = async (kind: 'One activity' | 'Day total', value: string) => {
		await budget.getByRole('button', { name: 'Add activity' }).click();
		const sheet = page.getByRole('dialog', { name: 'Activity' });
		await sheet.getByRole('radio', { name: kind }).click();
		await sheet.getByLabel('Calories burned (kcal)').fill(value);
		await sheet
			.getByRole('button', { name: kind === 'One activity' ? 'Add to budget' : 'Save day total' })
			.click();
		await expect(sheet).toBeHidden();
	};
	await addActivity('Day total', '300');
	await expect(budget).toContainText('2136 base + 300 activity − 550 goal');
	await addActivity('Day total', '650');
	await expect(budget).toContainText('2136 base + 650 activity − 550 goal');
	await addActivity('One activity', '100');
	await expect(budget).toContainText('2136 base + 750 activity − 550 goal');
	await budget.getByRole('button', { name: 'Add activity' }).click();
	await expect(page.getByRole('dialog', { name: 'Activity' })).toContainText(
		'Day total so far: 650 kcal'
	);
	await page
		.getByRole('dialog', { name: 'Activity' })
		.getByRole('button', { name: 'Close' })
		.click();

	// Turning activity off: kept and shown, but not added.
	await page.goto('/profile');
	await page.getByLabel('Add calories I burn to my budget').uncheck();
	await expect(page.getByRole('status')).toContainText('Budget settings saved');
	await expect(page.getByRole('radio', { name: 'Keep deficit' })).toHaveAttribute(
		'aria-checked',
		'true'
	);
	await page.getByRole('radio', { name: 'Maintain' }).click();
	await expect(page.getByRole('radio', { name: 'Maintain' })).toHaveAttribute(
		'aria-checked',
		'true'
	);
	await page.goto('/');
	await expect(budget).toContainText('2136 base + 0 activity − 550 goal');
	await expect(budget).toContainText('750 kcal burned, not added (your budget setting).');
});
