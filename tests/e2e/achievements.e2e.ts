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
	// An earned badge plays its celebration again (owner, 2026-11-09, as in the demo); Done returns to the badge.
	const badge = kilos.getByRole('button', { name: /4 kg lost, / });
	await badge.click();
	const again = page.getByRole('dialog', { name: 'Achievement: 4 kg lost' });
	await expect(again).toContainText("That's a pumpkin.");
	await expect(again.getByRole('link', { name: 'See all achievements' })).toHaveCount(0);
	await again.getByRole('button', { name: 'Done' }).click();
	await expect(again).toBeHidden();
	await expect(badge).toBeFocused();
	await expect(kilos.getByRole('button', { name: /Next: 6 kg/ })).toHaveCount(0); // not reached yet

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

test('confetti falls, stays where it lands, and a tap on the background throws it up again', async ({
	page
}, testInfo) => {
	await signedInAs(page, `Konfeti ${testInfo.project.name}`);
	await page.goto('/progress');
	await apiAs(page, 'POST', '/api/v1/body/weight', { date: daysAgo(5), zone, value: 90 });
	await page.goto('/achievements');
	await page.getByRole('button', { name: /First weigh-in/ }).click();
	const dialog = page.getByRole('dialog', { name: /Achievement/ });
	await expect(dialog).toBeVisible();
	// The page behind is held still, so its scroll bar doesn't show through.
	await expect(page.locator('body')).toHaveCSS('position', 'fixed');

	/** How many painted pixels the confetti has in a band: the bottom 70 px, or everything above the bottom third. */
	const painted = (band: 'bottom' | 'upper') =>
		dialog.locator('canvas').evaluate((canvas: HTMLCanvasElement, band) => {
			const ratio = canvas.width / canvas.clientWidth;
			const top = band === 'bottom' ? canvas.height - 70 * ratio : 0;
			const height = band === 'bottom' ? 70 * ratio : (canvas.height * 2) / 3;
			const { data } = canvas.getContext('2d')!.getImageData(0, top, canvas.width, height);
			let count = 0;
			for (let i = 3; i < data.length; i += 4) if (data[i] > 0) count++;
			return count;
		}, band);

	// Everything lands at the bottom, comes to rest, and is still there later.
	await expect.poll(() => painted('bottom'), { timeout: 10_000 }).toBeGreaterThan(2000);
	await expect.poll(() => painted('upper'), { timeout: 10_000 }).toBe(0);
	const resting = async () => {
		const before = await painted('bottom');
		await page.waitForTimeout(700);
		return (await painted('bottom')) === before && before > 2000;
	};
	await expect.poll(resting, { timeout: 10_000 }).toBe(true);
	const landed = await painted('bottom');
	await page.waitForTimeout(1500);
	expect(await painted('bottom')).toBe(landed);

	await dialog.click({ position: { x: 20, y: 200 } });
	await expect.poll(() => painted('upper')).toBeGreaterThan(1000);
	await expect(dialog).toBeVisible();
	await dialog.getByRole('button', { name: 'Done' }).click();
	await expect(page.locator('body')).not.toHaveCSS('position', 'fixed');
});
