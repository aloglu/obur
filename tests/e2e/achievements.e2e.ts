import { expect, test } from '@playwright/test';
import { apiAs, losingToward, signedInAs } from './fixtures.ts';

const zone = 'Europe/Istanbul';
const daysAgo = (n: number) => {
	const d = new Date();
	d.setDate(d.getDate() - n);
	return d.toLocaleDateString('en-CA');
};

test('a new weight mark is celebrated once; older ones arrive quietly', async ({
	page
}, testInfo) => {
	const userId = await signedInAs(page, `Rozet ${testInfo.project.name}`);
	await losingToward(userId, 80);
	await page.emulateMedia({ reducedMotion: 'reduce' });
	await page.goto('/progress');
	await apiAs(page, 'POST', '/api/v1/body/weight', { date: daysAgo(40), zone, value: 100 });
	await apiAs(page, 'POST', '/api/v1/body/weight', { date: daysAgo(20), zone, value: 98 });
	await apiAs(page, 'POST', '/api/v1/body/weight', { date: daysAgo(0), zone, value: 95.9 });

	await page.goto('/');
	// Only the new 4 kg mark: 2 kg was reached weeks ago.
	const toast = page.getByRole('button', { name: /^4 kg lost\. That's a pumpkin/ });
	await expect(toast).toBeVisible();
	await toast.click();
	const dialog = page.getByRole('dialog', { name: 'Achievement: 4 kg lost' });
	await expect(dialog).toContainText("That's a pumpkin.");
	await expect(dialog).toContainText('Carved off.');
	await expect(dialog.getByRole('button', { name: 'Done' })).toBeFocused();
	const seen = page.waitForResponse(/achievements\/seen/);
	await dialog.getByRole('button', { name: 'Done' }).click();
	await seen; // being marked as seen is a request of its own
	await expect(dialog).toBeHidden();

	// Celebrated once.
	await page.reload();
	await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
	await page.waitForTimeout(500);
	await expect(page.getByRole('button', { name: /kg lost\./ })).toHaveCount(0);

	// Progress links to the badge page: the next mark, then both earned ones, newest first.
	await page.goto('/progress');
	await page.getByRole('link', { name: /Achievements/ }).click();
	await expect(page.getByRole('heading', { level: 1, name: 'Achievements' })).toBeVisible();
	const kilos = page.getByRole('region', { name: 'Kilos lost' });
	await expect(kilos).toContainText('2 so far · one every 2 kg');
	await expect(kilos.getByRole('listitem')).toHaveText([
		/Next: 6 kg lost/,
		new RegExp(`4 kg lost, `),
		new RegExp(`2 kg lost, `)
	]);
	await expect(page.getByRole('region', { name: 'Streaks of complete days' })).toContainText(
		'Next: 3 complete days in a row'
	);
	// Weighing in at all is the first of the first steps; the other firsts appear only once earned.
	await expect(page.getByRole('region', { name: 'Firsts' }).getByRole('listitem')).toHaveText([
		/First weigh-in/
	]);

	// The Journal shows it among the month's highlights.
	await page.goto('/journal');
	await expect(page.getByRole('link', { name: /4 kg lost.*a pumpkin/ })).toBeVisible();
});

test('without a goal below the start, weight achievements stay off and say why', async ({
	page
}) => {
	await signedInAs(page, 'Hedefsiz');
	await page.goto('/achievements');
	await expect(page.getByRole('region', { name: 'Kilos lost' })).toContainText(
		'Weight achievements need a goal weight below where you started'
	);
});
