import { expect, test, type Page } from '@playwright/test';
import { signedInAs } from './fixtures.ts';

const isPhone = (page: Page) => (page.viewportSize()?.width ?? 1000) < 760;

test('reminders: a switch and the system time picker per reminder, quiet hours, saved by themselves', async ({
	page
}, testInfo) => {
	await signedInAs(page, `Hatırlatma ${testInfo.project.name}`);
	await page.goto(isPhone(page) ? '/more' : '/settings');
	await page.getByRole('link', { name: 'Reminders' }).click();
	await expect(page.getByRole('heading', { level: 1, name: 'Reminders' })).toBeVisible();

	// This device: on an iPhone in Safari (not the installed app) the page explains how to install; elsewhere it
	// offers to turn notifications on. Turning them on needs a real push service, so it's checked on the phone.
	if (isPhone(page)) await expect(page.getByText('Add to Home Screen')).toBeVisible();
	// Headless Chromium keeps notifications blocked, so either state is right here; the page says how to allow them.
	else
		await expect(
			page
				.getByRole('button', { name: 'Turn on notifications' })
				.or(page.getByText('Notifications are blocked for obur'))
		).toBeVisible();

	const lunch = page.getByRole('switch', { name: 'Lunch' });
	await expect(lunch).toHaveAttribute('aria-checked', 'false');
	await lunch.click();
	await expect(lunch).toHaveAttribute('aria-checked', 'true');
	const time = page.getByLabel('Lunch time');
	// The browser's own time input (the phone shows its native picker).
	await expect(time).toHaveAttribute('type', 'time');
	await expect(time).toHaveValue('14:00');
	await time.fill('13:30');
	await time.dispatchEvent('change');
	await expect(page.getByRole('status').filter({ hasText: 'Saved' })).toBeVisible();
	await page.getByLabel('From').fill('23:00');
	await page.getByLabel('From').dispatchEvent('change');
	await expect(page.getByRole('status').filter({ hasText: 'Saved' })).toBeVisible();

	await page.reload();
	await expect(page.getByRole('switch', { name: 'Lunch' })).toHaveAttribute('aria-checked', 'true');
	await expect(page.getByLabel('Lunch time')).toHaveValue('13:30');
	await expect(page.getByLabel('From')).toHaveValue('23:00');
	await expect(page.getByRole('switch', { name: 'Dinner' })).toHaveAttribute(
		'aria-checked',
		'false'
	);
	await expect(page.getByLabel('Dinner time')).toHaveCount(0);
});
