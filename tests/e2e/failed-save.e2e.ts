// A setting whose save fails shows what is saved again, so it can be tried again (2026-11-25 Review.md audit, 2.3).
import { expect, test, type Page } from '@playwright/test';
import { choose, losingToward, signedInAs } from './fixtures.ts';

/** Every change to `url` fails as a server error would. */
const refuse = (page: Page, url: string) =>
	page
		.context()
		.route(url, (route) =>
			route.request().method() === 'GET'
				? route.continue()
				: route.fulfill({ status: 500, contentType: 'application/json', body: '{"error":"error"}' })
		);

test.describe('a failed save', () => {
	test.skip(({ browserName }) => browserName !== 'chromium', 'needs Chromium request routing');

	test('Units: a time format that could not be saved goes back', async ({ page }) => {
		await signedInAs(page, 'Failed Save Time');
		await page.goto('/more/units');
		const before = await page.getByRole('button', { name: /^Time:/ }).textContent();
		await refuse(page, '**/api/v1/profile/preferences');
		await choose(page, 'Time', '12-hour');
		await expect(page.getByText("That setting couldn't be saved.")).toBeVisible();
		await expect(page.getByRole('button', { name: /^Time:/ })).toHaveText(before!);
		// And the same choice can be tried again.
		await page.context().unroute('**/api/v1/profile/preferences');
		await choose(page, 'Time', '12-hour');
		await expect(page.getByRole('button', { name: /^Time:/ })).toContainText('12-hour');
	});

	test('Goal: a pace that could not be saved goes back', async ({ page }) => {
		const userId = await signedInAs(page, 'Failed Save Pace');
		await losingToward(userId, 70);
		await page.goto('/more/goal');
		const pace = page.getByRole('button', { name: /^Pace:/ });
		const before = await pace.textContent();
		await refuse(page, '**/api/v1/targets/settings');
		await choose(page, 'Pace', /^Steady/);
		await expect(page.getByRole('alert')).toBeVisible();
		await expect(pace).toHaveText(before!);
	});

	test('Profile: a switch that could not be saved goes back', async ({ page }) => {
		const userId = await signedInAs(page, 'Failed Save Switch');
		await losingToward(userId, 70);
		await page.goto('/profile');
		const activity = page.getByRole('switch', { name: 'Add calories I burn to my budget' });
		await expect(activity).toBeChecked();
		await refuse(page, '**/api/v1/targets/settings');
		await activity.click();
		await expect(page.getByRole('alert')).toBeVisible();
		await expect(activity).toBeChecked();
	});
});

test('Settings shows a new appearance at once, not after half a minute (2026-11-25 Review.md audit, 2.4)', async ({
	page
}) => {
	await signedInAs(page, 'Fresh Appearance');
	await page.goto('/more/settings');
	await expect(page.getByRole('link', { name: /Appearance/ })).not.toContainText('Dark');
	await page.getByRole('link', { name: /Appearance/ }).click();
	const saved = page.waitForResponse(
		(r) => r.url().includes('/api/v1/profile/preferences') && r.request().method() === 'PATCH'
	);
	await page.getByRole('radio', { name: 'Dark' }).click();
	await saved;
	await page.getByRole('link', { name: 'Settings', exact: true }).first().click();
	await expect(page.getByRole('link', { name: /Appearance/ })).toContainText('Dark');
	await page.getByRole('link', { name: /Appearance/ }).click();
	await expect(page.getByRole('radio', { name: 'Dark' })).toBeChecked();
});
