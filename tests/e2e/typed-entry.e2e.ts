import { expect, test } from '@playwright/test';
import { createFood, signedInAs, choose } from './fixtures.ts';

test('a typed sentence becomes items to confirm, logged together and undone together', async ({
	page
}, testInfo) => {
	const tag = testInfo.project.name.replace(/[^a-z]/gi, '');
	await signedInAs(page, `Ece ${tag}`);
	await createFood(page, {
		name: `Tahıllı Ekmek ${tag}`,
		brand: 'Fırıncı',
		basis: '100g',
		nutrients: [{ code: 'energy_kcal', value: 250, qualifier: 'reported' }],
		servings: [{ name: 'dilim', amount: 30, unit: 'g' }]
	});
	await page.goto('/log');

	await page.getByRole('button', { name: 'Type it' }).click();
	const sheet = page.getByRole('dialog', { name: 'Type what you ate' });
	await expect(sheet.getByLabel('You typed')).toBeFocused();
	await sheet
		.getByLabel('You typed')
		.fill(`kahvaltıda iki dilim tahıllı ekmek ${tag} ve iki bardak su`);
	const bread = sheet.getByRole('region', { name: `Fırıncı Tahıllı Ekmek ${tag}` });
	await expect(bread.getByRole('button', { name: /^Unit: dilim \(30 g\)/ })).toBeVisible();
	await expect(bread).toContainText('150 kcal'); // 2 × 30 g at 250 kcal per 100 g
	await expect(sheet.getByRole('region', { name: 'Water' }).getByLabel('Millilitres')).toHaveValue(
		'400'
	);
	await expect(sheet.getByRole('radio', { name: 'Breakfast' })).toBeChecked();

	// A vague amount must be filled in before anything can be logged.
	await sheet
		.getByLabel('You typed')
		.fill(`kahvaltıda biraz tahıllı ekmek ${tag} ve iki bardak su`);
	await expect(sheet).toContainText('How much? Enter an amount.');
	await expect(sheet.getByRole('button', { name: /^Log 2 to/ })).toBeDisabled();
	await sheet.getByLabel('Amount').fill('2');
	await choose(sheet, 'Unit', 'dilim (30 g)');
	await sheet.getByRole('button', { name: /^Log 2 to/ }).click();

	const toast = page.getByRole('status');
	await expect(toast).toContainText('Logged 2 items');
	await expect(page.getByRole('region', { name: 'Breakfast' })).toContainText('150');
	await expect(page.getByRole('region', { name: 'Water' })).toContainText('400 ml');
	await toast.getByRole('button', { name: 'Undo' }).click();
	await expect(page.getByRole('region', { name: 'Breakfast' }).getByRole('listitem')).toHaveCount(
		0
	);
	await expect(page.getByRole('region', { name: 'Water' })).toContainText('0 ml');
});

test('weight, calories-only and a curated food with a bare count', async ({ page }, testInfo) => {
	await signedInAs(page, `Kaan ${testInfo.project.name}`);
	await page.goto('/log');
	await page.getByRole('button', { name: 'Type it' }).click();
	const sheet = page.getByRole('dialog', { name: 'Type what you ate' });
	await sheet.getByLabel('You typed').fill('bugün 80,5 kiloydum');
	await expect(sheet.getByLabel('Weight (kg)')).toHaveValue('80,5');
	// Change the sentence: a curated banana and a calories-only snack.
	await sheet.getByLabel('You typed').fill('bir muz ve 120 kcal snack');
	const banana = sheet.getByRole('region', { name: 'Banana' });
	await expect(banana.getByRole('button', { name: /^Unit: medium/ })).toBeVisible();
	await expect(banana).toContainText('105 kcal');
	await expect(
		sheet.getByRole('region', { name: 'Calories only' }).getByLabel('Calories (kcal)')
	).toHaveValue('120');
	await sheet.getByRole('button', { name: /^Log 2 to/ }).click();
	await expect(page.getByRole('status')).toContainText('Logged 2 items');
	await expect(page.getByRole('region', { name: 'Snacks' })).toContainText('Banana');
});

test('the meal follows the sentence, and goes back when the meal word goes', async ({
	page
}, testInfo) => {
	await signedInAs(page, `Öğün ${testInfo.project.name}`);
	await page.goto('/log?meal=lunch');
	await page.getByRole('button', { name: 'Type it' }).click();
	const sheet = page.getByRole('dialog', { name: 'Type what you ate' });
	const text = sheet.getByLabel('You typed');
	await expect(sheet.getByRole('radio', { name: 'Lunch' })).toBeChecked();
	await text.fill('300 kcal for dinner');
	await expect(sheet.getByRole('radio', { name: 'Dinner' })).toBeChecked();
	await text.fill('300 kcal');
	await expect(sheet.getByRole('radio', { name: 'Lunch' })).toBeChecked();
	// A meal tapped is remembered once the text stops naming one.
	await sheet.getByRole('radio', { name: 'Snacks' }).click();
	await text.fill('300 kcal for dinner');
	await expect(sheet.getByRole('radio', { name: 'Dinner' })).toBeChecked();
	await text.fill('300 kcal');
	await expect(sheet.getByRole('radio', { name: 'Snacks' })).toBeChecked();
	await sheet.getByRole('button', { name: 'Log 1 to Snacks' }).click();
	await expect(page.getByRole('region', { name: 'Snacks' })).toContainText('300');
});

test('without a connection Type it offers calories alone, which can wait on the device', async ({
	page,
	context
}, testInfo) => {
	await signedInAs(page, `Yolda ${testInfo.project.name}`);
	await page.goto('/log');
	await page.waitForLoadState('networkidle');
	await page.getByRole('button', { name: 'Type it' }).click();
	await context.setOffline(true);
	const sheet = page.getByRole('dialog', { name: 'Type what you ate' });
	await sheet.getByLabel('You typed').fill('iki yumurta');
	const calories = sheet.getByRole('button', { name: 'Log calories only' });
	await expect(calories).toBeVisible();

	// Back online, the sentence is read after all.
	await context.setOffline(false);
	await page.evaluate(() => dispatchEvent(new Event('online')));
	await expect(calories).toBeHidden();

	await context.setOffline(true);
	await sheet.getByLabel('You typed').fill('üç yumurta');
	await calories.click();
	await expect(page.getByRole('dialog', { name: 'Log calories only' })).toBeVisible();
	await context.setOffline(false);
});

test('Recent is always on the Log screen and fits above the tab bar', async ({
	page
}, testInfo) => {
	test.skip(!testInfo.project.name.includes('phone'), 'The tab bar is the phone’s');
	await signedInAs(page, `Son ${testInfo.project.name}`);
	for (let i = 0; i < 8; i++) {
		await createFood(page, {
			name: `Yemek ${i}`,
			basis: '100g',
			nutrients: [{ code: 'energy_kcal', value: 100, qualifier: 'reported' }]
		});
	}
	await page.goto('/log');
	await expect(page.getByRole('region', { name: 'Recent' })).toBeVisible();
	await expect(page.getByRole('button', { name: 'Type it' })).toBeVisible();
	await expect(page.getByRole('button', { name: 'Speak' })).toBeVisible();
});

test('a food with one unit has it chosen, so a count alone is enough', async ({
	page
}, testInfo) => {
	const name = `Tekbirim ${testInfo.project.name}`;
	await signedInAs(page, `Birim ${testInfo.project.name}`);
	await createFood(page, {
		name,
		basis: '100g',
		nutrients: [{ code: 'energy_kcal', value: 200, qualifier: 'reported' }]
	});
	await page.goto('/log');
	await page.getByRole('button', { name: 'Type it' }).click();
	const sheet = page.getByRole('dialog', { name: 'Type what you ate' });
	await sheet.getByLabel('You typed').fill(`50 g ${name}`);
	await expect(sheet.getByRole('region', { name }).getByLabel('Amount')).toHaveValue('50');
	await expect(sheet).not.toContainText('Choose a unit');
	await expect(sheet.getByRole('button', { name: /^Log 1 to/ })).toBeEnabled();
});
