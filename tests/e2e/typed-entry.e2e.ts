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
	// A compact row; tapping it opens the amount and unit.
	await expect(bread).toContainText('150'); // 2 × 30 g at 250 kcal per 100 g
	await expect(bread).toContainText('2 dilim (30 g) · Breakfast');
	await bread.getByRole('button', { name: /^Edit / }).click();
	await expect(bread.getByRole('button', { name: /^Unit: dilim \(30 g\)/ })).toBeVisible();
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
	await expect(sheet.getByLabel('Amount')).toHaveCount(1); // the row it replaced has slid away
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

test('a fraction of a container and a portion named by its own word (owner report 2026-11-09)', async ({
	page
}, testInfo) => {
	const tag = testInfo.project.name.replace(/[^a-z]/gi, '');
	await signedInAs(page, `Mert ${tag}`);
	await createFood(page, {
		name: `Ricotta Peyniri ${tag}`,
		brand: null,
		basis: '100g',
		nutrients: [{ code: 'energy_kcal', value: 150, qualifier: 'reported' }],
		servings: [{ name: 'Container', amount: 300, unit: 'g' }]
	});
	await createFood(page, {
		name: `Oat Drink ${tag}`,
		brand: null,
		basis: '100ml',
		nutrients: [{ code: 'energy_kcal', value: 50, qualifier: 'reported' }],
		servings: [{ name: 'Cup', amount: 240, unit: 'ml' }]
	});
	await page.goto('/log');
	await page.getByRole('button', { name: 'Type it' }).click();
	const sheet = page.getByRole('dialog', { name: 'Type what you ate' });
	await sheet
		.getByLabel('You typed')
		.fill(`I ate 1/3s of a container of ricotta peyniri ${tag} and 2 cups of oat drink ${tag}`);
	const ricotta = sheet.getByRole('region', { name: `Ricotta Peyniri ${tag}` });
	await expect(ricotta).toContainText('150'); // a third of 300 g at 150 kcal per 100 g
	await expect(ricotta).toContainText('0,33 Container (300 g)');
	const oat = sheet.getByRole('region', { name: `Oat Drink ${tag}` });
	await expect(oat).toContainText('240'); // 2 × 240 ml at 50 kcal per 100 ml
	await expect(oat).toContainText('2 Cup (240 ml)');
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
	await expect(banana).toContainText('105');
	await expect(banana).not.toContainText('Which one?'); // found through its Turkish alias, so no question
	await banana.getByRole('button', { name: /^Edit / }).click();
	await expect(banana.getByRole('button', { name: /^Unit: medium/ })).toBeVisible();
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

test('a loose match asks which one, and a food not found offers a way out', async ({
	page
}, testInfo) => {
	const tag = testInfo.project.name.replace(/\W/g, '');
	await signedInAs(page, `Belirsiz ${testInfo.project.name}`);
	for (const name of [`Karpuzlu${tag}`, `Karpuzcuk${tag}`]) {
		await createFood(page, {
			name,
			basis: '100g',
			nutrients: [{ code: 'energy_kcal', value: 100, qualifier: 'reported' }]
		});
	}
	await page.goto('/log');
	await page.getByRole('button', { name: 'Type it' }).click();
	const sheet = page.getByRole('dialog', { name: 'Type what you ate' });

	// A misspelling: the top match is only typo-tolerant, so it asks, and logging waits for the answer.
	await sheet.getByLabel('You typed').fill(`100 g karpuzlu${tag}x for snacks`);
	await expect(sheet).toContainText('Not sure. Which one?');
	await expect(
		sheet.getByRole('button', { name: 'Choose the item marked ? first' })
	).toBeDisabled();
	await expect(sheet.getByRole('button', { name: /Something else/ })).toBeVisible();
	await sheet.getByRole('button', { name: new RegExp(`^Karpuzlu${tag}`) }).click();
	await expect(sheet).not.toContainText('Not sure');
	await expect(sheet.getByRole('button', { name: 'Log 1 to Snacks' })).toBeEnabled();

	// Nothing like it: three ways out, and it doesn't hold the rest back.
	await sheet.getByLabel('You typed').fill('qqqqzzzz ve 120 kcal snack');
	await expect(sheet).toContainText('Not in your foods yet');
	await expect(sheet.getByRole('button', { name: 'Create it as food' })).toBeVisible();
	await expect(sheet.getByRole('button', { name: 'Search your foods' })).toBeVisible();
	await sheet.getByRole('button', { name: 'Log calories only' }).click();
	await sheet.getByLabel('Calories (kcal)').first().fill('300');
	await expect(sheet.getByRole('button', { name: 'Log 2 to Snacks' })).toBeEnabled();
});

test('a food not found is left out when logging, and the toast says so', async ({
	page
}, testInfo) => {
	await signedInAs(page, `Eksik ${testInfo.project.name}`);
	await page.goto('/log');
	await page.getByRole('button', { name: 'Type it' }).click();
	const sheet = page.getByRole('dialog', { name: 'Type what you ate' });
	await sheet.getByLabel('You typed').fill('qqqqzzzz ve 120 kcal snack');
	await sheet.getByRole('button', { name: 'Log 1 to Snacks' }).click();
	await expect(page.getByRole('status')).toContainText('wasn’t logged'.replace('’', "'"));
	await expect(page.getByRole('region', { name: 'Snacks' })).toContainText('120');
});

test('Create it as food makes the food on top, then logs it with everything else kept', async ({
	page
}, testInfo) => {
	await signedInAs(page, `Yeni ${testInfo.project.name}`);
	// A made-up word per browser, kept to this account, so no other test can find it.
	const word = testInfo.project.name === 'phone-webkit' ? 'jjwwkkvv' : 'jjwwkkdd';
	await page.goto('/log');
	await page.getByRole('button', { name: 'Type it' }).click();
	const sheet = page.getByRole('dialog', { name: 'Type what you ate' });
	await sheet.getByLabel('You typed').fill(`200 g ${word} ve 120 kcal snack`);
	await expect(sheet).toContainText('Not in your foods yet');
	await sheet.getByRole('button', { name: 'Create it as food' }).click();

	// The form opens over the sheet with the name that was said; the page stays where it was.
	const form = page.getByRole('dialog', { name: 'New food' });
	await expect(form.getByLabel('Name', { exact: true })).toHaveValue(word);
	await expect(page).toHaveURL(/\/log/);
	await form.getByRole('textbox', { name: /^Energy kcal/ }).fill('150');
	await form.getByRole('radio', { name: 'Only me' }).click();
	await form.getByRole('button', { name: 'Save food' }).click();
	await expect(form).toBeHidden();

	// Back in the sheet: the typed text, the calories-only item and the 200 g are all still there.
	await expect(sheet.getByLabel('You typed')).toHaveValue(`200 g ${word} ve 120 kcal snack`);
	await expect(sheet).not.toContainText('Not in your foods yet');
	await expect(sheet.getByRole('button', { name: 'Log 2 to Snacks' })).toBeEnabled();
	await sheet.getByRole('button', { name: 'Log 2 to Snacks' }).click();
	const snacks = page.getByRole('region', { name: 'Snacks' });
	await expect(snacks).toContainText(word);
	await expect(snacks).toContainText('300'); // 200 g at 150 kcal per 100 g
	await expect(snacks).toContainText('120');
});

test('a match that ignores some of the words asks, so a food cannot drop out unnoticed', async ({
	page
}, testInfo) => {
	const tag = testInfo.project.name.replace(/\W/g, '');
	await signedInAs(page, `Virgül ${testInfo.project.name}`);
	await createFood(page, {
		name: `Yumurtam${tag}`,
		basis: '100g',
		nutrients: [{ code: 'energy_kcal', value: 150, qualifier: 'reported' }]
	});
	await page.goto('/log');
	await page.getByRole('button', { name: 'Type it' }).click();
	const sheet = page.getByRole('dialog', { name: 'Type what you ate' });
	await sheet.getByLabel('You typed').fill(`100 g yumurtam${tag}, karpuz`);
	await expect(sheet).toContainText('Not sure. Which one?');
	await expect(sheet).toContainText(`yumurtam${tag} karpuz?`);
});
