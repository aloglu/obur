import { expect, test, type Page } from '@playwright/test';
import { apiAs, signedInAs, choose } from './fixtures.ts';

/** A birth date that makes the person exactly `years` old today (birthdays count from the day itself). */
const bornYearsAgo = (years: number) => `${new Date().getFullYear() - years}-01-01`;

/** Opens the budget's breakdown (it starts closed) and checks its base, activity and goal rows. */
async function expectBreakdown(page: Page, base: number, activity: number, goal: number) {
	const budget = page.getByRole('region', { name: 'Budget' });
	const toggle = budget.getByRole('button', { name: /^Budget/ });
	if ((await toggle.getAttribute('aria-expanded')) !== 'true') await toggle.click();
	const rows = budget.locator('#budget-breakdown');
	await expect(rows).toContainText(`${base}`);
	await expect(rows).toContainText(`+${activity}`);
	await expect(rows).toContainText(`−${goal}`);
}

async function fillDetails(page: Page, birthDate: string) {
	await page.goto('/onboarding');
	await page.getByLabel('Height').fill('180');
	await page.getByLabel('Weight').fill('80');
	await page.getByLabel('Birth date').fill(birthDate);
	await page.getByRole('radio', { name: 'Male', exact: true }).click();
	await page.getByRole('button', { name: 'See my estimate' }).click();
}

test('onboarding calculates a budget; activity and completion update Today', async ({ page }) => {
	await signedInAs(page, 'Mehmet');
	await page.goto('/');
	const budget = page.getByRole('region', { name: 'Budget' });
	await page.goto('/onboarding');

	await fillDetails(page, bornYearsAgo(30));
	await expect(page.getByText('Step 2 of 3 · Your estimate')).toBeVisible();
	await expect(page.getByText('24,7', { exact: true })).toBeVisible();
	await expect(page.getByText('Healthy weight (WHO adult category)')).toBeVisible();
	await expect(page.getByText("can't tell muscle from fat")).toBeVisible();
	// Mifflin–St Jeor: 10·80 + 6.25·180 − 5·30 + 5 = 1,780; × 1.2 = 2,136.
	await expect(page.getByText('2136', { exact: true })).toBeVisible();
	await page.getByRole('button', { name: 'Choose a goal' }).click();
	await page.getByRole('radio', { name: '0,5', exact: true }).click();
	await expect(page.getByText('1586', { exact: true }).first()).toBeVisible();
	await expect(page.getByText('not medical advice').first()).toBeVisible();
	await page.getByRole('button', { name: 'Save my budget' }).click();

	await expect(page.getByRole('heading', { level: 1, name: 'Today' })).toBeVisible();
	await expect(budget).toContainText('1586 kcal');
	await expectBreakdown(page, 2136, 0, 550);
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
	await expectBreakdown(page, 2136, 300, 550);

	// Marking the day complete is a switch.
	const complete = page.getByRole('switch', { name: 'Day complete' });
	await expect(complete).toHaveAttribute('aria-checked', 'false');
	await complete.click();
	await expect(complete).toHaveAttribute('aria-checked', 'true');
	await complete.click();
	await expect(complete).toHaveAttribute('aria-checked', 'false');

	// A new weight moves the calculated budget from today on (base 2,136 − 10 × 2 × 1.2 = 2,112); Undo moves it back.
	const weight = page.getByRole('region', { name: 'Weight' });
	await weight.getByRole('button', { name: 'New weigh-in' }).click();
	await weight.getByLabel('New weight').fill('78');
	await weight.getByRole('button', { name: 'Save' }).click();
	const toast = page.getByRole('status');
	await expect(toast).toContainText('Saved 78 kg');
	await expect(toast).toContainText('Budget now 1562 kcal (was 1586)');
	await expectBreakdown(page, 2112, 300, 550);
	await toast.getByRole('button', { name: 'Undo' }).click();
	await expectBreakdown(page, 2136, 300, 550);

	// The Profile page shows the target and says it follows the weight.
	await page.goto('/profile');
	await expect(page.getByText('1586', { exact: true })).toBeVisible();
	for (const value of ['2136 kcal', '− 550 kcal', '1500 kcal'])
		await expect(page.getByRole('definition').filter({ hasText: value })).toBeVisible();
	await expect(page.getByText('Updates from the day you log a new weight.')).toBeVisible();

	// About you: rows that open setup's first step. Saving that step is enough: the calculated budget follows from
	// today even when setup goes no further.
	const about = page.getByRole('region', { name: 'About you' });
	await expect(about.getByRole('link', { name: /^Height/ })).toContainText('180 cm');
	await expect(about.getByRole('link', { name: /^Body fat/ })).toContainText('Not set');
	await expect(page.getByText('Weight comes from your weigh-ins on Today.')).toBeVisible();
	await about.getByRole('link', { name: /^Height/ }).click();
	await expect(page.getByLabel('Height')).toHaveValue('180');
	// 182 cm and 79 kg: 10·79 + 6.25·182 − 5·30 + 5 = 1,782.5; × 1.2 = 2,139 base.
	await page.getByLabel('Height').fill('182');
	await page.getByLabel('Weight', { exact: true }).fill('79');
	await page.getByRole('button', { name: 'See my estimate' }).click();
	await expect(page.getByText(/^Step 2 of 3/)).toBeVisible();
	await page.getByRole('link', { name: 'Profile' }).click();
	await expect(about.getByRole('link', { name: /^Height/ })).toContainText('182 cm');
	await expect(page.getByRole('definition').filter({ hasText: '2139 kcal' })).toBeVisible();

	// Goal: the goal weight in place, the pace from a menu; each is a new budget version from today.
	await page
		.getByRole('link', { name: 'More', exact: true })
		.filter({ visible: true })
		.first()
		.click();
	await page.getByRole('link', { name: /^Goal/ }).click();
	await expect(page.getByRole('heading', { level: 1, name: 'Goal' })).toBeVisible();
	await page.getByRole('button', { name: /^Goal weight/ }).click();
	await page.getByLabel('New goal weight').fill('74');
	await page.getByRole('button', { name: 'Save', exact: true }).click();
	await expect(page.getByRole('button', { name: /^Goal weight/ })).toContainText('74 kg');
	await choose(page, 'Pace', 'Steady · 0,25 kg a week');
	await expect(page.getByRole('status')).toContainText('Budget settings saved');
	await page
		.getByRole('link', { name: 'More', exact: true })
		.filter({ visible: true })
		.first()
		.click();
	await expect(page.getByRole('link', { name: /^Goal/ })).toContainText('Steady · 0,25 kg a week');
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

	await page.getByRole('button', { name: 'Enter a target I was given' }).click();
	await page.getByLabel('Daily budget').fill('2000');
	await page.getByRole('button', { name: 'Use this budget' }).click();
	const budget = page.getByRole('region', { name: 'Budget' });
	await expect(budget).toContainText('2000 kcal');
	await budget.getByRole('button', { name: /^Budget/ }).click();
	await expect(budget.locator('#budget-breakdown')).toContainText('Your own target');

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
	await page.goto('/onboarding');
	await fillDetails(page, bornYearsAgo(30));
	await page.getByRole('button', { name: 'Choose a goal' }).click();
	await page.getByRole('radio', { name: '0,5', exact: true }).click();
	await page.getByLabel(/Goal weight/).fill('75');
	await page.getByRole('button', { name: 'Save my budget' }).click();
	await expectBreakdown(page, 2136, 0, 550);

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
	await expectBreakdown(page, 2136, 300, 550);
	await addActivity('Day total', '650');
	await expectBreakdown(page, 2136, 650, 550);
	await addActivity('One activity', '100');
	await expectBreakdown(page, 2136, 750, 550);
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
	const activity = page.getByRole('switch', { name: 'Add calories I burn to my budget' });
	await expect(activity).toHaveAttribute('aria-checked', 'true');
	await activity.click();
	await expect(page.getByRole('status')).toContainText('Budget settings saved');
	await expect(activity).toHaveAttribute('aria-checked', 'false');
	await page.getByRole('radio', { name: 'Maintain' }).click();
	await expect(page.getByRole('radio', { name: 'Maintain' })).toHaveAttribute(
		'aria-checked',
		'true'
	);
	// Own macro percentages: they start from the balanced split, must add up to 100 %, and apply from today.
	await page.getByRole('radio', { name: 'My own %' }).click();
	const protein = page.getByLabel('Protein', { exact: true });
	await expect(protein).not.toHaveValue('');
	await protein.fill('30');
	await page.getByLabel('Carbs', { exact: true }).fill('20');
	await page.getByLabel('Fat', { exact: true }).fill('60');
	await expect(page.getByText('Adds up to 110 %. Make it 100 %.')).toBeVisible();
	await expect(page.getByRole('button', { name: 'Save macro targets' })).toBeDisabled();
	await page.getByLabel('Carbs', { exact: true }).fill('10');
	await page.getByRole('button', { name: 'Save macro targets' }).click();
	await expect(page.getByRole('button', { name: 'Saved' })).toBeVisible();

	await page.goto('/');
	await expectBreakdown(page, 2136, 0, 550);
	await expect(budget).toContainText('750 kcal burned, not added (your budget setting).');
	// 1,586 kcal: protein 30 % / 4 = 119 g, carbs 10 % / 4 = 40 g, fat 60 % / 9 = 106 g.
	const nutrients = page.getByRole('region', { name: 'Nutrients' });
	await expect(nutrients).toContainText('/ 119 g');
	await expect(nutrients).toContainText('/ 40 g');
	await expect(nutrients).toContainText('/ 106 g');
});

test('first day: the welcome offers a budget once, and "Just log" leaves no mention of it on Today', async ({
	page
}, testInfo) => {
	await signedInAs(page, `Selin ${testInfo.project.name}`);
	await page.goto('/');
	const welcome = page.getByRole('region', { name: /^Welcome, Selin/ });
	await expect(welcome).toBeVisible();
	await welcome.getByRole('button', { name: 'Just log' }).click();
	await expect(page.getByRole('status')).toContainText('Set one up any time in More → Profile');
	await expect(welcome).toBeHidden();
	await page.reload();
	await expect(page.getByRole('heading', { level: 1, name: 'Today' })).toBeVisible();
	await expect(welcome).toBeHidden();
	await expect(page.getByRole('link', { name: /budget/i })).toHaveCount(0);
	await page.goto('/profile');
	await expect(page.getByText('Optional. A budget shows what')).toBeVisible();
});
