import { expect, test, type Page } from '@playwright/test';
import { apiAs, choose, signedInAs } from './fixtures.ts';

async function usePounds(page: Page) {
	await page.goto('/more/units');
	await choose(page, /^Weight:/, 'Pounds (lb)');
	await expect(page.getByRole('button', { name: 'Weight: Pounds (lb)' })).toBeVisible();
}

test('weights are shown and typed in pounds, and stored so they show again as typed', async ({
	page
}, testInfo) => {
	await signedInAs(page, `Pounds ${testInfo.project.name}`);
	await usePounds(page);
	await page.getByRole('link', { name: 'Settings', exact: true }).first().click();
	await expect(page.getByRole('link', { name: /Units.*lb · / })).toBeVisible();

	// The weigh-in field, its toast and the card.
	await page.goto('/');
	const weight = page.getByRole('region', { name: 'Weight' });
	await weight.getByRole('button', { name: 'New weigh-in' }).click();
	await expect(weight).toContainText('lb');
	await weight.getByLabel('New weight').fill('185.2');
	await weight.getByRole('button', { name: 'Save' }).click();
	await expect(page.getByRole('status')).toContainText('Saved 185.2 lb');
	await expect(weight).toContainText('185.2 lb');
	await weight.getByRole('button', { name: 'New weigh-in' }).click();
	await weight.getByLabel('New weight').fill('182');
	await weight.getByRole('button', { name: 'Save' }).click();
	await expect(weight).toContainText('182 lb');
	await expect(weight).toContainText('−3.2 lb');

	// The list of weigh-ins: shown and edited in pounds.
	await weight.getByRole('button', { name: 'Edit or delete weigh-ins' }).click();
	const sheet = page.getByRole('dialog');
	await expect(sheet).toContainText('185.2 lb');
	await sheet.getByRole('button', { name: /^Edit 182 lb/ }).click();
	await expect(sheet.getByRole('textbox')).toHaveValue('182');
	await sheet.getByRole('textbox').fill('181.4');
	await sheet.getByRole('button', { name: 'Save' }).click();
	await expect(sheet).toContainText('181.4 lb');
	await page.keyboard.press('Escape');
	await expect(weight).toContainText('181.4 lb');

	// A typed weigh-in without a unit is in pounds; one said in kilos is shown in pounds.
	await page.goto('/log');
	await page.getByRole('button', { name: 'Type it' }).click();
	const typed = page.getByRole('dialog', { name: 'Type what you ate' });
	await typed.getByLabel('You typed').fill('I weighed 80 kg');
	await expect(typed).toContainText('176.4 lb');
	await typed.getByLabel('You typed').fill('I weighed 180');
	await expect(typed).toContainText('180 lb');
	await typed.getByRole('button', { name: /^Log/ }).click();
	await expect(page.getByRole('status')).toContainText('Logged');

	// The Journal's day.
	await page.goto('/journal');
	await expect(page.getByText('180 lb', { exact: true })).toBeVisible();

	// Back to kilograms: the same weigh-in, 81.65 kg.
	await page.goto('/more/units');
	await choose(page, /^Weight:/, 'Kilograms (kg)');
	await page.goto('/');
	await expect(page.getByRole('region', { name: 'Weight' })).toContainText('81.65 kg');
});

test('Progress shows the weight, its change and the goal in pounds', async ({ page }, testInfo) => {
	await signedInAs(page, `Progress lb ${testInfo.project.name}`);
	await usePounds(page);
	await page.goto('about:blank');
	const zone = 'Europe/Istanbul';
	const daysAgo = (n: number) => {
		const d = new Date();
		d.setDate(d.getDate() - n);
		return d.toLocaleDateString('en-CA');
	};
	await apiAs(page, 'POST', '/api/v1/targets', {
		mode: 'manual',
		effectiveFrom: daysAgo(40),
		budgetKcal: 2000,
		goalWeightKg: 79.38 // 175 lb
	});
	await apiAs(page, 'POST', '/api/v1/body/weight', { date: daysAgo(20), zone, value: 84 });
	await apiAs(page, 'POST', '/api/v1/body/weight', { date: daysAgo(0), zone, value: 82.6 });

	await page.goto('/progress?range=1M');
	const weight = page.getByRole('tabpanel');
	await expect(weight).toContainText(/182\.1\s*lb/);
	await expect(weight).toContainText('−3.1 lb');
	await expect(weight).toContainText('To goal (175.0 lb)');
	await expect(weight.locator('[aria-live="polite"]')).toContainText(': 182.1 lb');
});

test('setup and the Goal page take weights and paces in pounds', async ({ page }, testInfo) => {
	await signedInAs(page, `Setup lb ${testInfo.project.name}`);
	await usePounds(page);
	await page.goto('/onboarding');
	await page.getByLabel('Height').fill('180');
	await page.getByLabel('Weight').fill('176.4'); // 80.01 kg
	await page.getByLabel('Birth date').fill(`${new Date().getFullYear() - 30}-01-01`);
	await page.getByRole('radio', { name: 'Male', exact: true }).click();
	await page.getByRole('button', { name: 'See my estimate' }).click();
	// The same estimate as 80 kg: 10·80 + 6.25·180 − 5·30 + 5 = 1,780; × 1.2 = 2,136.
	await expect(page.getByText('2136', { exact: true })).toBeVisible();
	await page.getByRole('button', { name: 'Choose a goal' }).click();
	await expect(page.getByText('Pace, lb a week')).toBeVisible();
	await page.getByLabel('Goal weight').fill('175');
	await page.getByRole('radio', { name: '1', exact: true }).click();
	await page.getByRole('button', { name: 'Save my budget' }).click();
	await expect(page.getByRole('heading', { level: 1, name: 'Today' })).toBeVisible();
	await expect(page.getByRole('region', { name: 'Weight' })).toContainText('176.4 lb');

	await page.goto('/more/goal');
	await expect(page.getByRole('button', { name: /^Goal weight/ })).toContainText('175 lb');
	await expect(page.getByRole('button', { name: /^Pace:/ })).toContainText('Brisk · 1 lb a week');
	await page.getByRole('button', { name: /^Goal weight/ }).click();
	await page.getByLabel('New goal weight').fill('170');
	await page.getByRole('button', { name: 'Save', exact: true }).click();
	await expect(page.getByRole('button', { name: /^Goal weight/ })).toContainText('170 lb');
	const paceSaved = page.waitForResponse(
		(r) => r.url().includes('/api/v1/targets') && r.request().method() !== 'GET' && r.ok()
	);
	await choose(page, 'Pace', 'Fast · 1.5 lb a week');
	await paceSaved;
	await page.getByRole('link', { name: 'Settings', exact: true }).click();
	await expect(page.getByRole('link', { name: /^Goal/ })).toContainText('Fast · 1.5 lb a week');
});
