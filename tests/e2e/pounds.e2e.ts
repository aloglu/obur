import { expect, test, type Page } from '@playwright/test';
import { apiAs, choose, losingToward, signedInAs } from './fixtures.ts';

/** Changes the weight unit on Units and waits for it to be saved. */
async function setUnit(page: Page, label: 'Pounds (lb)' | 'Kilograms (kg)') {
	await page.goto('/more/units');
	const saved = page.waitForResponse(
		(r) => r.url().includes('/api/v1/profile/preferences') && r.request().method() === 'PATCH'
	);
	await choose(page, /^Weight:/, label);
	await saved;
	await expect(page.getByRole('button', { name: `Weight: ${label}` })).toBeVisible();
	// The page refreshes its data after the save; a test that loads another page at once would cut that short.
	await page.waitForLoadState('networkidle');
}
const usePounds = (page: Page) => setUnit(page, 'Pounds (lb)');

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
	await setUnit(page, 'Kilograms (kg)');
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
	await page.goto('/onboarding');
	await page.getByLabel('Height', { exact: true }).fill('180');
	await page.getByLabel('Weight', { exact: true }).fill('80');
	await page.getByLabel('Waist', { exact: true }).fill('86.4');
	// Each field's unit is a button: what was typed follows, and the account keeps the units.
	const saved = page.waitForResponse(
		(r) => r.url().includes('/api/v1/profile/preferences') && r.request().method() === 'PATCH'
	);
	await page.getByRole('button', { name: /^Height unit: cm/ }).click();
	await saved;
	await expect(page.getByLabel('Height, feet')).toHaveValue('5');
	await expect(page.getByLabel('Height, inches')).toHaveValue('10.9'); // 180.1 cm
	await expect(page.getByLabel('Waist', { exact: true })).toHaveValue('34');
	await page.getByRole('button', { name: /^Weight unit: kg/ }).click();
	await expect(page.getByLabel('Weight', { exact: true })).toHaveValue('176.4'); // 80.01 kg
	// A height that can't be used marks the field, with the button still off (audit D03).
	await page.getByLabel('Height, inches').fill('12');
	await expect(page.getByLabel('Height, inches')).toHaveAttribute('aria-invalid', 'true');
	await page.getByLabel('Height, inches').fill('10'); // 177.8 cm
	await expect(page.getByLabel('Height, inches')).not.toHaveAttribute('aria-invalid', 'true');
	await page.getByLabel('Birth date').fill(`${new Date().getFullYear() - 30}-01-01`);
	await page.getByRole('radio', { name: 'Male', exact: true }).click();
	await page.getByRole('button', { name: 'See my estimate' }).click();
	// 10·80.01 + 6.25·177.8 − 5·30 + 5 = 1,766.4; × 1.2 = 2,120.
	await expect(page.getByText('2120', { exact: true })).toBeVisible();
	await page.getByRole('button', { name: 'Choose a goal' }).click();
	await expect(page.getByText('Pace, lb a week')).toBeVisible();
	await page.getByLabel('Goal weight').fill('175');
	await page.getByRole('radio', { name: '1', exact: true }).click();
	await page.getByRole('button', { name: 'Save my budget' }).click();
	await expect(page.getByRole('heading', { level: 1, name: 'Today' })).toBeVisible();
	await expect(page.getByRole('region', { name: 'Weight' })).toContainText('176.4 lb');

	await page.goto('/more/units');
	await expect(page.getByRole('button', { name: 'Weight: Pounds (lb)' })).toBeVisible();
	await expect(
		page.getByRole('button', { name: 'Height and waist: Feet and inches (ft, in)' })
	).toBeVisible();
	await expect(page.getByRole('button', { name: 'Water: Millilitres (ml)' })).toBeVisible();
	await page.goto('/profile');
	await expect(page.getByText('5 ft 10 in')).toBeVisible();
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

test('weight achievements come every 5 lb, with pound words where kilo words would show', async ({
	page
}, testInfo) => {
	const userId = await signedInAs(page, `Rozet lb ${testInfo.project.name}`);
	await losingToward(userId, 70);
	await usePounds(page);
	await page.emulateMedia({ reducedMotion: 'reduce' });
	await page.goto('about:blank');
	const zone = 'Europe/Istanbul';
	const daysAgo = (n: number) => {
		const d = new Date();
		d.setDate(d.getDate() - n);
		return d.toLocaleDateString('en-CA');
	};
	// 220 lb, then 190 lb weeks ago (30 lb, quietly), then 185 lb today: the 35 lb mark.
	await apiAs(page, 'POST', '/api/v1/body/weight', { date: daysAgo(60), zone, value: 99.79 });
	await apiAs(page, 'POST', '/api/v1/body/weight', { date: daysAgo(20), zone, value: 86.18 });
	await apiAs(page, 'POST', '/api/v1/body/weight', { date: daysAgo(0), zone, value: 83.91 });

	await page.goto('/');
	const toast = page.getByRole('button', { name: /^35 lb lost\. That's a 35\slb kettlebell/ });
	await expect(toast).toBeVisible();
	await toast.click();
	const dialog = page.getByRole('dialog', { name: 'Achievement: 35 lb lost' });
	await expect(dialog).toContainText(/That's a 35\slb kettlebell\./);
	await expect(dialog).toContainText('You were carrying a gym.');
	await dialog.getByRole('button', { name: 'Done' }).click();
	await expect(dialog).toBeHidden();

	await page.goto('/achievements');
	const pounds = page.getByRole('region', { name: 'Pounds lost' });
	await expect(pounds).toContainText('7 so far · one every 5 lb');
	await expect(pounds.getByRole('listitem').first()).toHaveText(/Next: 40 lb lost/);
	await expect(page.getByRole('region', { name: 'Kilos lost' })).toHaveCount(0);

	await page.goto('/journal');
	await expect(page.getByRole('link', { name: /35 lb lost.*a 35\slb kettlebell/ })).toBeVisible();

	// Back to kilograms: kilo marks, earned before, arrive quietly (no toast).
	await setUnit(page, 'Kilograms (kg)');
	await page.goto('/achievements');
	await expect(page.getByRole('region', { name: 'Kilos lost' })).toContainText('one every 2 kg');
	await page.goto('/');
	await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
	await page.waitForTimeout(500);
	await expect(page.getByRole('button', { name: /kg lost\./ })).toHaveCount(0);
});

test('water in US fluid ounces: added, typed and listed in ounces, stored in millilitres', async ({
	page
}, testInfo) => {
	await signedInAs(page, `Fluid ${testInfo.project.name}`);
	await page.goto('/more/units');
	const saved = page.waitForResponse(
		(r) => r.url().includes('/api/v1/profile/preferences') && r.request().method() === 'PATCH'
	);
	await choose(page, 'Water', 'US fluid ounces (fl oz)');
	await saved;
	await page.waitForLoadState('networkidle');
	await page.getByRole('link', { name: 'Settings', exact: true }).first().click();
	await expect(page.getByRole('link', { name: /Units.*kg · cm · fl oz · / })).toBeVisible();

	await page.goto('/');
	const water = page.getByRole('region', { name: 'Water' });
	await expect(water).toContainText('0 fl oz');
	await water.getByRole('button', { name: 'Add 8 fl oz of water' }).click();
	await expect(page.getByRole('status')).toContainText('Added 8 fl oz of water');
	await expect(water).toContainText('8 fl oz');
	await water.getByRole('button', { name: 'Other amount' }).click();
	await water.getByLabel('Amount of water').fill('400');
	await water.getByRole('button', { name: 'Add water' }).click();
	await expect(water).toContainText('up to 338 fl oz');
	await water.getByLabel('Amount of water').fill('16.9');
	await water.getByRole('button', { name: 'Add water' }).click();
	await expect(water).toContainText('25 fl oz'); // 24.9
	await water.getByRole('button', { name: 'Edit or delete water' }).click();
	await expect(page.getByRole('dialog')).toContainText('16.9 fl oz');
	await page.keyboard.press('Escape');

	// Typed: a bare "oz" of water is fluid ounces.
	await page.goto('/log');
	await page.getByRole('button', { name: 'Type it' }).click();
	const typed = page.getByRole('dialog', { name: 'Type what you ate' });
	await typed.getByLabel('You typed').fill('16 oz of water');
	await expect(typed).toContainText('16 fl oz');
	await typed.getByRole('button', { name: /^Log/ }).click();
	await expect(page.getByRole('status')).toContainText('Logged');

	// Back to millilitres: 236.6 + 499.8 + 473.2 ml.
	await page.goto('/more/units');
	const back = page.waitForResponse(
		(r) => r.url().includes('/api/v1/profile/preferences') && r.request().method() === 'PATCH'
	);
	await choose(page, 'Water', 'Millilitres (ml)');
	await back;
	await page.waitForLoadState('networkidle');
	await page.goto('/');
	await expect(page.getByRole('region', { name: 'Water' })).toContainText('1210 ml');
});

test.describe('on a phone in the UK', () => {
	// Feet and inches with kilograms, from the time zone (an English (US) phone language changes nothing).
	test.use({ timezoneId: 'Europe/London', locale: 'en-US' });

	test('a new account starts with its phone region units; each setup field switches its own', async ({
		page
	}, testInfo) => {
		await signedInAs(page, `Region ${testInfo.project.name}`);
		await page.goto('/onboarding');
		await expect(page.getByLabel('Height, feet')).toBeVisible();
		await expect(page.getByRole('button', { name: /^Weight unit: kg/ })).toBeVisible();
		await page.getByLabel('Height, feet').fill('5');
		await page.getByLabel('Height, inches').fill('11');
		await page.getByLabel('Weight', { exact: true }).fill('80');
		// The birth date is as tall as the other fields and as wide as its row (iOS draws date fields shorter).
		const box = async (l: import('@playwright/test').Locator) => (await l.boundingBox())!;
		const date = await box(page.getByLabel('Birth date'));
		const weightBox = await box(page.getByLabel('Weight', { exact: true }).locator('..'));
		const sexRow = await box(page.getByRole('radiogroup', { name: 'Sex used by the formula' }));
		expect(Math.round(date.height)).toBe(Math.round(weightBox.height));
		expect(Math.round(date.width)).toBe(Math.round(sexRow.width));
		// Height in centimetres instead: the waist follows (one setting), the weight stays.
		const saved = page.waitForResponse(
			(r) => r.url().includes('/api/v1/profile/preferences') && r.request().method() === 'PATCH'
		);
		await page.getByRole('button', { name: /^Height unit: in/ }).click();
		await saved;
		await expect(page.getByLabel('Height', { exact: true })).toHaveValue('180.3');
		await expect(page.getByRole('button', { name: /^Waist unit: cm/ })).toBeVisible();
		await expect(page.getByLabel('Weight', { exact: true })).toHaveValue('80');
		await page.getByRole('button', { name: /^Weight unit: kg/ }).click();
		await expect(page.getByLabel('Weight', { exact: true })).toHaveValue('176.4');
		await page.waitForLoadState('networkidle');
		await page.goto('/more/units');
		await expect(page.getByRole('button', { name: 'Weight: Pounds (lb)' })).toBeVisible();
		await expect(
			page.getByRole('button', { name: 'Height and waist: Centimetres (cm)' })
		).toBeVisible();
		await expect(page.getByRole('button', { name: 'Water: Millilitres (ml)' })).toBeVisible();
	});

	test('an account that already has records keeps its units', async ({ page }, testInfo) => {
		await signedInAs(page, `Older ${testInfo.project.name}`);
		await apiAs(page, 'POST', '/api/v1/body/weight', {
			date: new Date().toLocaleDateString('en-CA'),
			zone: 'Europe/London',
			value: 80
		});
		await page.goto('/more/units');
		await expect(page.getByRole('button', { name: 'Weight: Kilograms (kg)' })).toBeVisible();
		await expect(
			page.getByRole('button', { name: 'Height and waist: Centimetres (cm)' })
		).toBeVisible();
	});
});

test('setup saves no weigh-in unless the weight is typed, and checks the optional fields', async ({
	page
}, testInfo) => {
	await signedInAs(page, `Setup again ${testInfo.project.name}`);
	await usePounds(page);
	const today = new Date().toLocaleDateString('en-CA');
	await apiAs(page, 'POST', '/api/v1/body/weight', {
		date: today,
		zone: 'Europe/Istanbul',
		value: 80
	});
	const weighIns = async () =>
		(
			await apiAs<{ readings: unknown[] }>(
				page,
				'GET',
				`/api/v1/body/weight?from=2026-01-01&to=${today}`
			)
		).readings.length;
	await page.goto('/onboarding');
	// 80 kg shown as 176.4 lb, which reads back as 80.01 kg: not a new weigh-in (2026-11-22 audit, A07).
	await expect(page.getByLabel('Weight', { exact: true })).toHaveValue('176.4');
	await page.getByLabel('Height', { exact: true }).fill('180');
	await page.getByLabel('Birth date').fill(`${new Date().getFullYear() - 30}-01-01`);
	await page.getByRole('radio', { name: 'Male', exact: true }).click();
	// A filled optional field out of range is marked and keeps Next off (A08).
	await page.getByLabel('Body fat').fill('90');
	await page.getByLabel('Height', { exact: true }).focus();
	await expect(page.getByLabel('Body fat')).toHaveAttribute('aria-invalid', 'true');
	await expect(page.getByRole('button', { name: 'See my estimate' })).toBeDisabled();
	await page.getByLabel('Body fat').fill('20');
	await page.getByRole('button', { name: 'See my estimate' }).click();
	await expect(page.getByRole('button', { name: 'Choose a goal' })).toBeVisible();
	expect(await weighIns()).toBe(1);
});
