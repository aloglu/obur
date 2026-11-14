import { expect, test } from '@playwright/test';
import { apiAs, signedInAs } from './fixtures.ts';

test('water: quick additions add up and can be undone', async ({ page }) => {
	await signedInAs(page, 'Ayşe');
	await page.goto('/');
	const water = page.getByRole('region', { name: 'Water' });
	await expect(water).toContainText('0 ml');
	await water.getByRole('button', { name: 'Add 250 ml of water' }).click();
	await expect(water).toContainText('250 ml');
	await water.getByRole('button', { name: 'Add 500 ml of water' }).click();
	await expect(water).toContainText('750 ml');
	await page.getByRole('status').getByRole('button', { name: 'Undo' }).click();
	await expect(water).toContainText('250 ml');

	// Any other amount: the button becomes a field; its suffix switches between ml and l per entry.
	const height = async () => (await water.boundingBox())!.height;
	const closed = await height();
	await water.getByRole('button', { name: 'Other amount' }).click();
	const amount = water.getByLabel('Amount of water');
	expect(await height()).toBe(closed); // the field takes the button's place without growing the card
	await amount.fill('12');
	await water.getByRole('button', { name: 'Unit: millilitres. Switch to litres' }).click();
	await water.getByRole('button', { name: 'Add water' }).click();
	await expect(water).toContainText('up to 10 l');
	await amount.fill('3,5');
	await water.getByRole('button', { name: 'Add water' }).click();
	await expect(water).toContainText('3750 ml');
	await expect(amount).toBeHidden();

	// Buttons show a pointer; a disabled one the plain arrow (Tailwind 4 resets both to the default).
	const cursor = (l: import('@playwright/test').Locator) =>
		l.evaluate((el) => getComputedStyle(el).cursor);
	expect(await cursor(water.getByRole('button', { name: 'Edit or delete water' }))).toBe('pointer');
	const weight = page.getByRole('region', { name: 'Weight' });
	await weight.getByRole('button', { name: 'New weigh-in' }).click();
	await weight.getByLabel('New weight').fill('0');
	const save = weight.getByRole('button', { name: 'Save' });
	await expect(save).toBeDisabled();
	expect(await cursor(save)).toBe('default');
});

test('weight: decimal comma input, validation, and readings stay private', async ({
	page,
	browser
}, testInfo) => {
	await signedInAs(page, 'Mehmet');
	await page.goto('/');
	const weight = page.getByRole('region', { name: 'Weight' });
	await expect(weight).toContainText('No weigh-ins yet.');

	await weight.getByRole('button', { name: 'New weigh-in' }).click();
	await weight.getByLabel('New weight').fill('82,4,1');
	await expect(weight).toContainText('Enter a weight such as 82.4');
	await weight.getByLabel('New weight').fill('82,4');
	await weight.getByRole('button', { name: 'Save' }).click();
	await expect(page.getByRole('status')).toContainText('Saved 82.4 kg');
	await expect(weight).toContainText('82.4 kg');
	await expect(weight).toContainText('First weigh-in');
	await expect(weight.getByLabel('New weight')).toBeHidden();

	// Another member does not see it.
	const other = await browser.newContext({ ...testInfo.project.use });
	const otherPage = await other.newPage();
	await signedInAs(otherPage, 'Zeynep');
	await otherPage.goto('/');
	await expect(otherPage.getByRole('region', { name: 'Weight' })).toContainText(
		'No weigh-ins yet.'
	);
	await other.close();
});

test('weight: the card shows the change since the last weigh-in; a tap elsewhere closes its field', async ({
	page
}) => {
	await signedInAs(page, 'Elif');
	const yesterday = await page.evaluate(() => {
		const d = new Date();
		d.setDate(d.getDate() - 1);
		return d.toLocaleDateString('en-CA');
	});
	for (const [date, value] of [
		[yesterday, 83.1],
		[await page.evaluate(() => new Date().toLocaleDateString('en-CA')), 82.8]
	] as const) {
		await apiAs(page, 'POST', '/api/v1/body/weight', { date, zone: 'Europe/Istanbul', value });
	}
	await page.goto('/');
	const weight = page.getByRole('region', { name: 'Weight' });
	await expect(weight).toContainText('82.8 kg');
	await expect(weight).toContainText(/−0\.3 kg\s+since/);
	await expect(weight.getByRole('img', { name: 'Last seven weigh-ins' })).toBeVisible();

	// Only one field open at a time, and a tap on nothing closes it.
	const water = page.getByRole('region', { name: 'Water' });
	await weight.getByRole('button', { name: 'New weigh-in' }).click();
	await expect(weight.getByLabel('New weight')).toBeFocused();
	await water.getByRole('button', { name: 'Other amount' }).click();
	await expect(weight.getByLabel('New weight')).toBeHidden();
	await expect(water.getByLabel('Amount of water')).toBeVisible();
	await page.getByRole('heading', { level: 1 }).click();
	await expect(water.getByLabel('Amount of water')).toBeHidden();

	// Empty, the check closes the field too, without an error or a save.
	await water.getByRole('button', { name: 'Other amount' }).click();
	await water.getByRole('button', { name: 'Add water', exact: true }).click();
	await expect(water.getByLabel('Amount of water')).toBeHidden();
	await expect(water.getByRole('button', { name: 'Other amount' })).toBeVisible();
	await weight.getByRole('button', { name: 'New weigh-in' }).click();
	await weight.getByRole('button', { name: 'Save', exact: true }).click();
	await expect(weight.getByLabel('New weight')).toBeHidden();
	await expect(weight).toContainText('82.8 kg');
});

test('water: a reading can be edited or deleted after the toast is gone', async ({ page }) => {
	await signedInAs(page, 'Deniz');
	await page.goto('/');
	const water = page.getByRole('region', { name: 'Water' });
	await expect(water.getByRole('button', { name: 'Edit or delete water' })).toHaveCount(0);
	await water.getByRole('button', { name: 'Add 250 ml of water' }).click();
	await expect(water).toContainText('250 ml');
	await water.getByRole('button', { name: 'Add 500 ml of water' }).click();
	await expect(water).toContainText('750 ml');

	await water.getByRole('button', { name: 'Edit or delete water' }).click();
	const sheet = page.getByRole('dialog', { name: 'Water · Today' });
	await sheet.getByRole('button', { name: /^Edit 250 ml/ }).click();
	await sheet.getByLabel(/New value in ml/).fill('330');
	await sheet.getByRole('button', { name: 'Save' }).click();
	await expect(water).toContainText('830 ml');

	// A deleted row stays in the sheet with its own Undo.
	await sheet.getByRole('button', { name: /^Delete 500 ml/ }).click();
	await expect(water).toContainText('330 ml');
	await sheet.getByRole('button', { name: /^Undo deleting 500 ml/ }).click();
	await expect(water).toContainText('830 ml');
	await sheet.getByRole('button', { name: /^Delete 500 ml/ }).click();
	await sheet.getByRole('button', { name: 'Close' }).click();
	await expect(water).toContainText('330 ml');
	await page.reload();
	await expect(water).toContainText('330 ml');
});

test('weight: older weigh-ins page in and can be edited or deleted', async ({ page }) => {
	await signedInAs(page, 'Can');
	const days = await page.evaluate(() =>
		[0, 3, 400].map((back) => {
			const d = new Date();
			d.setDate(d.getDate() - back);
			return d.toLocaleDateString('en-CA');
		})
	);
	// 21 old readings make a second page; one more a year earlier sits behind a long gap.
	await apiAs(page, 'POST', '/api/v1/body/weight', { date: days[2], zone: 'UTC', value: 90 });
	for (let i = 0; i < 21; i++)
		await apiAs(page, 'POST', '/api/v1/body/weight', { date: days[1], zone: 'UTC', value: 85 });
	await apiAs(page, 'POST', '/api/v1/body/weight', { date: days[0], zone: 'UTC', value: 84.2 });

	await page.goto('/');
	const weight = page.getByRole('region', { name: 'Weight' });
	await weight.getByRole('button', { name: 'Edit or delete weigh-ins' }).click();
	const sheet = page.getByRole('dialog', { name: 'Weigh-ins' });
	await expect(sheet.getByRole('button', { name: /^Edit / })).toHaveCount(20);
	await sheet.getByRole('button', { name: 'Show older' }).click();
	await expect(sheet.getByRole('button', { name: /^Edit / })).toHaveCount(23);
	await expect(sheet.getByRole('button', { name: /^Edit 90 kg/ })).toBeVisible();
	await sheet.getByRole('button', { name: 'Show older' }).click();
	await expect(sheet.getByRole('button', { name: 'Show older' })).toHaveCount(0); // nothing older left

	await sheet.getByRole('button', { name: /^Edit 84\.2 kg, Today/ }).click();
	await sheet.getByLabel(/New value in kg/).fill('83,9');
	await sheet.getByRole('button', { name: 'Save' }).click();
	await expect(weight).toContainText('83.9 kg');
	await sheet.getByRole('button', { name: /^Delete 83\.9 kg, Today/ }).click();
	await expect(weight).toContainText('85 kg');
});
