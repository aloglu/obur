// Sheets on phones (owner reports, 2026-11-23): a finger pulls a sheet down and letting go far or fast enough closes it;
// a short pull springs back. A file picker dismissed without a choice leaves the sheet open (its `cancel` event
// bubbles, and the sheet used to take it for Escape).
import { expect, test, type Page } from '@playwright/test';
import { signedInAs } from './fixtures.ts';

test.use({ viewport: { width: 390, height: 844 }, hasTouch: true });

/** A real touch drag through Chromium's input pipeline (WebKit in Playwright has no way to send one). */
async function drag(
	page: Page,
	from: { x: number; y: number },
	dy: number,
	steps: number,
	gapMs: number
) {
	const cdp = await page.context().newCDPSession(page);
	const at = (y: number) => [{ x: from.x, y }];
	await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: at(from.y) });
	for (let i = 1; i <= steps; i++) {
		await cdp.send('Input.dispatchTouchEvent', {
			type: 'touchMove',
			touchPoints: at(from.y + (dy * i) / steps)
		});
		if (gapMs) await page.waitForTimeout(gapMs);
	}
	await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
	await cdp.detach();
}

test('a sheet follows a finger down: a short pull springs back, a long one closes it', async ({
	page,
	browserName
}, testInfo) => {
	test.skip(browserName !== 'chromium', 'touch drags are sent through Chromium only');
	await signedInAs(page, `Kaydıran ${testInfo.project.name}`);
	await page.goto('/log');
	await page.getByRole('button', { name: 'Type it' }).click();
	const sheet = page.getByRole('dialog', { name: 'Type what you ate' });
	await expect(sheet).toBeVisible();
	await page.waitForTimeout(500); // slid in
	const box = (await sheet.getByRole('heading').first().boundingBox())!;
	const grip = { x: box.x + 20, y: box.y + box.height / 2 };

	// A short, slow pull: back where it was, still open.
	await drag(page, grip, 40, 8, 40);
	await page.waitForTimeout(400);
	await expect(sheet).toBeVisible();
	expect(await sheet.evaluate((d) => d.style.transform)).toBe('');

	// Pulling up is an ordinary scroll, never a close.
	await drag(page, grip, -200, 10, 10);
	await page.waitForTimeout(300);
	await expect(sheet).toBeVisible();

	// A long pull closes it, and the page under the finger is not pressed.
	await drag(page, grip, 420, 14, 10);
	await expect(sheet).toBeHidden();
	await expect(page).toHaveURL(/\/log/);

	// It opens again as usual.
	await page.getByRole('button', { name: 'Type it' }).click();
	await expect(sheet).toBeVisible();
});

test('dismissing the photo picker leaves Scan open; Escape still closes it', async ({
	page
}, testInfo) => {
	await signedInAs(page, `Seçmeyen ${testInfo.project.name}`);
	await page.goto('/log');
	await page.getByRole('button', { name: 'Scan a label' }).click();
	const sheet = page.getByRole('dialog', { name: 'Scan a label' });
	await expect(sheet).toBeVisible();
	await page.waitForLoadState('networkidle');
	// What a browser does when its picker closes with nothing chosen.
	await page
		.getByLabel('Choose photo')
		.evaluate((input) => input.dispatchEvent(new Event('cancel', { bubbles: true })));
	await page.waitForTimeout(400);
	await expect(sheet).toBeVisible();
	await page.keyboard.press('Escape');
	await expect(sheet).toBeHidden();
});
