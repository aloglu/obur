import { expect, test } from '@playwright/test';
import { signedInAs } from './fixtures.ts';

test('Help: from More, searched without Turkish letters, answers open in place', async ({
	page
}) => {
	await signedInAs(page, 'Yardım');
	await page.goto('/more');
	await page.getByRole('link', { name: 'Help' }).click();
	await expect(page.getByRole('heading', { level: 1, name: 'Help' })).toBeVisible();

	// Topic chips narrow the list.
	await page.getByRole('button', { name: 'Budget', exact: true }).click();
	await expect(page.getByRole('region')).toHaveCount(1);
	await page.getByRole('button', { name: 'All', exact: true }).click();

	// "hatirlatma" finds the reminders answer (its search words include "hatırlatma"); a single match opens.
	await page.getByRole('searchbox', { name: 'Search help' }).fill('hatirlatma');
	const question = page.getByText('When do reminders come?');
	await expect(question).toBeVisible();
	await expect(page.getByText(/only if that thing is still missing/)).toBeVisible();

	await page.getByRole('searchbox', { name: 'Search help' }).fill('budget');
	await page.getByText('How is my daily budget worked out?').click();
	await expect(
		page.getByText('Budget = base burn (BMR × about 1,2) + activity − deficit')
	).toBeVisible();

	await page.getByRole('searchbox', { name: 'Search help' }).fill('pizza oven');
	await expect(page.getByText('Nothing matches “pizza oven”.')).toBeVisible();
});
