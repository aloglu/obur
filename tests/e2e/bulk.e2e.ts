import { expect, test, type Locator, type Page } from '@playwright/test';
import { apiAs, signedInAs } from './fixtures.ts';

const zone = 'Europe/Istanbul';
const isPhone = (page: Page) => (page.viewportSize()?.width ?? 1000) < 760;
const today = () => new Date().toLocaleDateString('en-CA');
const yesterday = () => {
	const d = new Date();
	d.setDate(d.getDate() - 1);
	return d.toLocaleDateString('en-CA');
};

/** Holds the pointer on a row until it lifts, optionally drags to another element, and lets go. */
async function hold(page: Page, row: Locator, to?: Locator) {
	await row.evaluate((e) =>
		window.scrollTo(0, e.getBoundingClientRect().top + window.scrollY - 160)
	);
	const from = (await row.boundingBox())!;
	await page.mouse.move(from.x + from.width / 2, from.y + from.height / 2);
	await page.mouse.down();
	await page.waitForTimeout(650);
	if (to) {
		const target = (await to.boundingBox())!;
		await page.mouse.move(target.x + target.width / 2, target.y + 30, { steps: 8 });
	}
	await page.mouse.up();
}

test('hold to select or drag; move, copy and delete several entries with one Undo', async ({
	page
}, testInfo) => {
	await signedInAs(page, `Toplu ${testInfo.project.name}`);
	const quick = (meal: string, kcal: number, description: string, date = today()) =>
		apiAs(page, 'POST', '/api/v1/diary/entries', {
			kind: 'quick',
			date,
			meal,
			zone,
			kcal,
			description
		});
	await quick('breakfast', 280, 'Simit');
	await quick('breakfast', 104, 'Beyaz peynir');
	await quick('lunch', 108, 'Ayran');
	await page.goto('/');
	const tip = page.getByRole('button', { name: 'Close tip' });
	await expect(page.getByText('Hold an entry: let go to select it')).toBeVisible();
	await tip.click();

	const meal = (name: string) => page.getByRole('region', { name, exact: true });
	const row = (name: string) =>
		page.getByRole('main').getByRole('button', { name: new RegExp(name) });
	const bar = page.getByRole('toolbar', { name: 'Selected entries' });

	// Hold and let go: selected; a tap adds another. The hold starts on the food icon, which passes touches to the
	// row (Safari would otherwise drag the image itself).
	await hold(page, row('Simit').locator('img').first());
	await expect(bar).toContainText('1 entry selected');
	await row('Beyaz peynir').click();
	await expect(bar).toContainText('2 entries selected');
	await expect(row('Simit')).toHaveAttribute('aria-pressed', 'true');

	// Move both to Dinner, then undo.
	await bar.getByRole('button', { name: 'Move to…' }).click();
	const sheet = page.getByRole('dialog', { name: 'Move 2 entries' });
	await expect(sheet.getByRole('radio', { name: 'Today' })).toHaveAttribute('aria-checked', 'true');
	await sheet.getByRole('radio', { name: 'Dinner' }).click();
	await sheet.getByRole('button', { name: 'Move to Dinner' }).click();
	await expect(page.getByRole('status')).toContainText('Moved 2 entries');
	await expect(meal('Dinner')).toContainText('Simit');
	await expect(bar).toBeHidden();
	await page.getByRole('status').getByRole('button', { name: 'Undo' }).click();
	await expect(meal('Breakfast')).toContainText('Simit');
	await expect(meal('Breakfast')).toContainText('Beyaz peynir');

	// Hold and drag: Ayran from Lunch onto Dinner.
	await hold(page, row('Ayran'), meal('Dinner'));
	await expect(page.getByRole('status')).toContainText('Moved 1 entry');
	await expect(meal('Dinner')).toContainText('Ayran');
	await expect(meal('Lunch')).not.toContainText('Ayran');

	// The meal menu: copy Dinner to yesterday's Snacks (the original stays).
	await meal('Dinner').getByRole('button', { name: 'Dinner actions' }).click();
	await page.getByRole('menuitem', { name: 'Copy meal to…' }).click();
	const copySheet = page.getByRole('dialog', { name: 'Copy 1 entry' });
	await copySheet.getByRole('radio', { name: 'Yesterday' }).click();
	await copySheet.getByRole('radio', { name: 'Snacks' }).click();
	await copySheet.getByRole('button', { name: 'Copy to Snacks' }).click();
	await expect(page.getByRole('status')).toContainText('Copied 1 entry');
	await expect(page.getByRole('status')).toContainText('To Snacks · Yesterday');
	await expect(meal('Dinner')).toContainText('Ayran');
	await page.goto(`/?date=${yesterday()}`);
	await expect(meal('Snacks')).toContainText('Ayran');
	await page.goto('/');

	// Delete a whole meal at once, then undo.
	await meal('Breakfast').getByRole('button', { name: 'Breakfast actions' }).click();
	await page.getByRole('menuitem', { name: 'Delete meal' }).click();
	await expect(page.getByRole('status')).toContainText('Deleted 2 entries');
	await expect(meal('Breakfast')).not.toContainText('Simit');
	await page.getByRole('status').getByRole('button', { name: 'Undo' }).click();
	await expect(meal('Breakfast')).toContainText('Simit');

	if (!isPhone(page)) {
		// Desktop shortcut: Ctrl/⌘-click selects without holding.
		await row('Simit').click({ modifiers: ['Control'] });
		await expect(bar).toContainText('1 entry selected');
		await page.keyboard.press('Escape');
		await expect(bar).toBeHidden();
	}
});
