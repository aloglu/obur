// Sheets on phones (owner reports, 2026-11-23): a finger pulls a sheet down and letting go far or fast enough closes it;
// a short pull springs back. A file picker dismissed without a choice leaves the sheet open (its `cancel` event
// bubbles, and the sheet used to take it for Escape).
import { expect, test, type Locator, type Page } from '@playwright/test';
import { signedInAs } from './fixtures.ts';

test.use({ viewport: { width: 390, height: 844 }, hasTouch: true });

interface DragOptions {
	steps?: number;
	gapMs?: number;
	/** Held still before it moves. */
	holdMs?: number;
	/** Held still at the end, before it lets go. */
	restMs?: number;
	/** How it ends: let go, the phone takes the touch, or a second finger comes. */
	ending?: 'end' | 'cancel' | 'second-finger';
}

/** A real touch drag through Chromium's input pipeline (WebKit in Playwright has no way to send one). */
async function drag(page: Page, from: { x: number; y: number }, dy: number, o: DragOptions = {}) {
	const { steps = 10, gapMs = 10, holdMs = 0, restMs = 0, ending = 'end' } = o;
	const cdp = await page.context().newCDPSession(page);
	const at = (y: number) => ({ x: from.x, y, id: 1 });
	await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [at(from.y)] });
	if (holdMs) await page.waitForTimeout(holdMs);
	for (let i = 1; i <= steps; i++) {
		await cdp.send('Input.dispatchTouchEvent', {
			type: 'touchMove',
			touchPoints: [at(from.y + (dy * i) / steps)]
		});
		if (gapMs) await page.waitForTimeout(gapMs);
	}
	if (restMs) await page.waitForTimeout(restMs);
	if (ending === 'cancel') {
		await cdp.send('Input.dispatchTouchEvent', { type: 'touchCancel', touchPoints: [] });
	} else {
		if (ending === 'second-finger')
			await cdp.send('Input.dispatchTouchEvent', {
				type: 'touchStart',
				touchPoints: [at(from.y + dy), { x: from.x + 80, y: from.y, id: 2 }]
			});
		await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
	}
	await cdp.detach();
}

async function openTypeIt(page: Page) {
	await page.goto('/log');
	await page.getByRole('button', { name: 'Type it' }).click();
	const sheet = page.getByRole('dialog', { name: 'Type what you ate' });
	await expect(sheet).toBeVisible();
	await page.waitForTimeout(500); // slid in
	const box = (await sheet.getByRole('heading').first().boundingBox())!;
	return { sheet, grip: { x: box.x + 20, y: box.y + box.height / 2 } };
}

/** Back where it was, open, and the scrim as dark as before. */
async function expectSettled(page: Page, sheet: Locator) {
	await page.waitForTimeout(400);
	await expect(sheet).toBeVisible();
	expect(
		await sheet.evaluate((d) => [d.style.transform, d.style.getPropertyValue('--pull')])
	).toEqual(['', '']);
}

test('a sheet follows a finger down: a short pull springs back, a long one closes it', async ({
	page,
	browserName
}, testInfo) => {
	test.skip(browserName !== 'chromium', 'touch drags are sent through Chromium only');
	await signedInAs(page, `Kaydıran ${testInfo.project.name}`);
	const { sheet, grip } = await openTypeIt(page);

	// A short, slow pull: back where it was, still open.
	await drag(page, grip, 40, { steps: 8, gapMs: 40 });
	await expectSettled(page, sheet);

	// Pulling up is an ordinary scroll, never a close.
	await drag(page, grip, -200);
	await expectSettled(page, sheet);

	// A long pull closes it, and the page under the finger is not pressed.
	await drag(page, grip, 420, { steps: 14 });
	await expect(sheet).toBeHidden();
	await expect(page).toHaveURL(/\/log/);

	// It opens again as usual.
	await page.getByRole('button', { name: 'Type it' }).click();
	await expect(sheet).toBeVisible();
});

test('a pull that stops, is taken by the phone, gets a second finger or starts with a hold never closes the sheet (audit S02, S03, S04, S07)', async ({
	page,
	browserName
}, testInfo) => {
	test.skip(browserName !== 'chromium', 'touch drags are sent through Chromium only');
	await signedInAs(page, `Vazgeçen ${testInfo.project.name}`);
	const { sheet, grip } = await openTypeIt(page);
	// Fast, then still for a moment before letting go: no longer a flick.
	await drag(page, grip, 60, { steps: 3, gapMs: 5, restMs: 300 });
	await expectSettled(page, sheet);
	// Far enough to close, but the phone takes the touch.
	await drag(page, grip, 420, { steps: 14, ending: 'cancel' });
	await expectSettled(page, sheet);
	// A second finger in the middle of a pull.
	await drag(page, grip, 150, { ending: 'second-finger' });
	await expectSettled(page, sheet);
	// Held before it moves: the phone's own text cursor, not a pull.
	await drag(page, grip, 420, { steps: 14, holdMs: 700 });
	await expectSettled(page, sheet);
});

test('pulling a sheet that is open over another closes only that one (audit S01)', async ({
	page,
	browserName
}, testInfo) => {
	test.skip(browserName !== 'chromium', 'touch drags are sent through Chromium only');
	await signedInAs(page, `İç içe ${testInfo.project.name}`);
	const { sheet } = await openTypeIt(page);
	await sheet.getByLabel('You typed').fill('200 g jjqqzzxx');
	await sheet.getByRole('button', { name: 'Create it as food' }).click();
	const form = page.getByRole('dialog', { name: 'New food' });
	await expect(form).toBeVisible();
	await page.waitForTimeout(500);
	const box = (await form.getByRole('heading').first().boundingBox())!;
	await drag(page, { x: box.x + 20, y: box.y + box.height / 2 }, 500, { steps: 14 });
	await expect(form).toBeHidden();
	await expectSettled(page, sheet);
	await expect(sheet.getByLabel('You typed')).toHaveValue('200 g jjqqzzxx');
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

test('a pull while the sheet still slides in, or just after it sprang back, follows the finger (audit S08)', async ({
	page,
	browserName
}, testInfo) => {
	test.skip(browserName !== 'chromium', 'touch drags are sent through Chromium only');
	await signedInAs(page, `Erken ${testInfo.project.name}`);
	await page.goto('/log');
	const sheet = page.getByRole('dialog', { name: 'Type what you ate' });
	const cdp = await page.context().newCDPSession(page);
	const touch = (type: 'touchStart' | 'touchMove' | 'touchEnd', y?: number) =>
		cdp.send('Input.dispatchTouchEvent', {
			type,
			touchPoints: y === undefined ? [] : [{ x: 60, y, id: 1 }]
		});
	/** Pulls 60 px from `y` (under a quarter of the sheet) and gives the sheet's top while the finger is down. */
	const pullAndMeasure = async (y: number) => {
		await touch('touchStart', y);
		for (let i = 1; i <= 3; i++) {
			await touch('touchMove', y + i * 20);
			await page.waitForTimeout(60); // slow: a pull, not a flick
		}
		await page.waitForTimeout(50);
		const top = (await sheet.boundingBox())!.y;
		await touch('touchEnd');
		return top;
	};
	await page.getByRole('button', { name: 'Type it' }).click();
	await expect(sheet).toBeVisible();
	const settledTop = await sheet.evaluate(async (d) => {
		await Promise.all(d.getAnimations().map((a) => a.finished));
		return d.getBoundingClientRect().y;
	});
	await expectSettled(page, sheet);

	// Again from the start, and pulled at once, while it slides in.
	await page.keyboard.press('Escape');
	await expect(sheet).toBeHidden();
	await page.waitForTimeout(400);
	await page.getByRole('button', { name: 'Type it' }).click();
	expect(await pullAndMeasure(settledTop + 30)).toBeGreaterThan(settledTop + 45);
	await expectSettled(page, sheet);

	// A short pull, then another before the sheet is back up.
	expect(await pullAndMeasure(settledTop + 30)).toBeGreaterThan(settledTop + 45);
	expect(await pullAndMeasure(settledTop + 30)).toBeGreaterThan(settledTop + 45);
	await expectSettled(page, sheet);
	await cdp.detach();
});
