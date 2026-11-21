// A toast can be swiped away on a phone, and dismissed from the keyboard (docs/ui.md, "Toast"; owner, 2026-11-21).
import { expect, test, type Locator, type Page } from '@playwright/test';
import { createFood, signedInAs } from './fixtures.ts';

async function showToast(page: Page, who: string): Promise<Locator> {
	await signedInAs(page, who);
	const id = await createFood(page, {
		name: 'Toast test bar',
		basis: '100g',
		nutrients: [{ code: 'energy_kcal', value: 400, qualifier: 'reported' }]
	});
	await page.goto(`/foods/${id}`);
	await page.getByRole('button', { name: 'Archive food' }).click();
	const toast = page.getByRole('status').locator('.toast');
	await expect(toast).toContainText('Food archived');
	return toast;
}

/** A finger's swipe, as pointer events (Playwright's touchscreen can only tap). */
async function swipe(toast: Locator, dx: number, dy: number) {
	await toast.evaluate(
		async (node, [dx, dy]) => {
			const box = node.getBoundingClientRect();
			const x = box.left + box.width / 2;
			const y = box.top + box.height / 2;
			const fire = (type: string, i: number) =>
				node.dispatchEvent(
					new PointerEvent(type, {
						bubbles: true,
						pointerId: 7,
						pointerType: 'touch',
						isPrimary: true,
						clientX: x + (dx * i) / 10,
						clientY: y + (dy * i) / 10
					})
				);
			fire('pointerdown', 0);
			// Slow enough that it is not a flick: only the distance decides.
			for (let i = 1; i <= 10; i++) {
				await new Promise((r) => setTimeout(r, 30));
				fire('pointermove', i);
			}
			fire('pointerup', 10);
		},
		[dx, dy]
	);
}

test('a short swipe puts the toast back; past half its width it goes, and Undo is not pressed', async ({
	page
}, testInfo) => {
	const toast = await showToast(page, `Kaydıran ${testInfo.project.name}`);
	const width = (await toast.boundingBox())!.width;

	await swipe(toast, width * 0.3, 0);
	await expect(toast).toBeVisible();
	await expect(toast).toHaveCSS('transform', 'none');

	await swipe(toast, -width * 0.6, 0);
	await expect(toast).toBeHidden();
	await expect(page).toHaveURL(/\/foods$/);
});

test('a swipe down takes the toast away; up does nothing', async ({ page }, testInfo) => {
	const toast = await showToast(page, `Aşağı ${testInfo.project.name}`);
	const height = (await toast.boundingBox())!.height;

	await swipe(toast, 0, -height);
	await expect(toast).toBeVisible();

	await swipe(toast, 0, height * 0.8);
	await expect(toast).toBeHidden();
});

test('a hidden Dismiss button shows when the keyboard reaches it and closes the toast', async ({
	page
}, testInfo) => {
	const toast = await showToast(page, `Klavye ${testInfo.project.name}`);
	const dismiss = toast.getByRole('button', { name: 'Dismiss' });
	expect((await dismiss.boundingBox())?.width ?? 0).toBeLessThanOrEqual(1);

	await toast.getByRole('button', { name: 'Undo' }).focus();
	await page.keyboard.press('Tab');
	await expect(dismiss).toBeFocused();
	expect((await dismiss.boundingBox())!.width).toBeGreaterThanOrEqual(44);
	await page.keyboard.press('Enter');
	await expect(toast).toBeHidden();
	await expect(page).toHaveURL(/\/foods$/);
});
