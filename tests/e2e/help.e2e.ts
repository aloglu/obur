import { expect, test } from '@playwright/test';
import { signedInAs } from './fixtures.ts';

test('Help: from More, searched without Turkish letters, answers open in place', async ({
	page
}) => {
	await signedInAs(page, 'Yardım');
	await page.goto('/more');
	await page.getByRole('link', { name: 'Help' }).click();
	await expect(page.getByRole('heading', { level: 1, name: 'Help' })).toBeVisible();

	// Answers grouped by topic, with no topic chips (owner, 2026-11-09); a question slides its answer open and shut.
	await expect(page.getByRole('button', { name: 'All', exact: true })).toHaveCount(0);
	const budget = page.getByRole('button', { name: 'How is my daily budget worked out?' });
	await expect(budget).toHaveAttribute('aria-expanded', 'false');
	await budget.click();
	await expect(budget).toHaveAttribute('aria-expanded', 'true');
	await expect(page.getByText(/Budget = base burn/)).toBeVisible();
	await budget.click();
	await expect(page.getByText(/Budget = base burn/)).toBeHidden();

	// "hatirlatma" finds the reminders answer (its search words include "hatırlatma"); a single match opens.
	await page.getByRole('searchbox', { name: 'Search help' }).fill('hatirlatma');
	const question = page.getByText('When do reminders come?');
	await expect(question).toBeVisible();
	await expect(page.getByText(/only if that thing is still missing/)).toBeVisible();

	await page.getByRole('searchbox', { name: 'Search help' }).fill('budget');
	await page.getByRole('button', { name: 'How is my daily budget worked out?' }).click();
	await expect(
		page.getByText('Budget = base burn (BMR × about 1,2) + activity − deficit')
	).toBeVisible();

	await page.getByRole('searchbox', { name: 'Search help' }).fill('pizza oven');
	await expect(page.getByText('Nothing matches “pizza oven”.')).toBeVisible();
});

test('Help explains the Journal rings with an example of each', async ({ page }) => {
	await signedInAs(page, 'Halka');
	await page.goto('/help');
	await page.getByRole('searchbox', { name: 'Search help' }).fill('halka');
	// The only match, so it is already open.
	await expect(page.getByText('What do the rings in the Journal mean?')).toBeVisible();
	const examples = page.getByRole('listitem').filter({ has: page.locator('svg') });
	await expect(examples).toHaveCount(4);
	await expect(examples.first()).toContainText('Green');
});

test('Help explains day notes', async ({ page }, testInfo) => {
	await signedInAs(page, `Notlar ${testInfo.project.name}`);
	await page.goto('/help');
	await page.getByRole('searchbox').fill('notlar');
	await expect(page.getByText('What are day notes?')).toBeVisible();
	await expect(page.getByText('Only you see your notes')).toBeVisible();
});
