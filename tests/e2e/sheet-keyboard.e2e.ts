import { expect, test, type Page } from '@playwright/test';
import { apiAs, createFood, signedInAs } from './fixtures.ts';

// A browser test can't open a phone's keyboard, so this stands in for what an iPhone reports with one up: a smaller
// visible area, either at the bottom (the phone moved the page up to keep the field in view) or at the top.
test.beforeEach(async ({ page }) => {
	await page.addInitScript(() => {
		const view = Object.assign(new EventTarget(), {
			scale: 1,
			offsetLeft: 0,
			offsetTop: 0,
			width: window.innerWidth,
			height: window.innerHeight
		});
		Object.defineProperty(window, 'visualViewport', { configurable: true, value: view });
		Object.assign(window, {
			setKeyboard(height: number, pageMovedUp: boolean) {
				view.height = window.innerHeight - height;
				view.offsetTop = pageMovedUp ? height : 0;
				view.dispatchEvent(new Event('resize'));
			}
		});
	});
});

test('a sheet growing while the keyboard is up stays in the visible area', async ({
	page
}, testInfo) => {
	const tag = `Klavye ${testInfo.project.name}`;
	await signedInAs(page, tag);
	for (let i = 0; i < 12; i++) {
		await createFood(page, {
			name: `${tag} ${i}`,
			brand: null,
			basis: '100g',
			nutrients: [{ code: 'energy_kcal', value: 100, qualifier: 'reported' }],
			servings: []
		});
	}
	await page.goto('/recipes');
	await page.getByRole('link', { name: 'New recipe' }).click();
	await page.getByRole('button', { name: 'Add food' }).click();
	const sheet = page.getByRole('dialog', { name: 'Add a food' });
	const search = sheet.getByLabel('Search foods');

	for (const pageMovedUp of [true, false]) {
		await search.fill('');
		await page.evaluate(
			(moved) => (window as unknown as Record<string, CallableFunction>).setKeyboard(300, moved),
			pageMovedUp
		);
		// The results make the sheet taller than the room above the keyboard.
		await search.fill(tag);
		await expect(sheet.getByRole('button', { name: new RegExp(tag) })).toHaveCount(12);

		await expect
			.poll(async () => {
				const box = (await sheet.boundingBox())!;
				const view = await page.evaluate(() => ({
					top: window.visualViewport!.offsetTop,
					height: window.visualViewport!.height
				}));
				return box.y >= view.top && box.y + box.height <= view.top + view.height + 0.5;
			})
			.toBe(true);
		await expect(sheet.getByRole('heading', { name: 'Add a food' })).toBeInViewport();
	}
});

test('Add a food offers recent foods before anything is typed', async ({ page }, testInfo) => {
	const tag = `Yakın ${testInfo.project.name}`;
	await signedInAs(page, tag);
	const id = await createFood(page, {
		name: `${tag} peynir`,
		brand: null,
		basis: '100g',
		nutrients: [{ code: 'energy_kcal', value: 300, qualifier: 'reported' }],
		servings: []
	});
	await apiAs(page, 'POST', '/api/v1/diary/entries', {
		kind: 'food',
		foodId: id,
		amount: 100,
		unit: { kind: 'mass', unit: 'g' },
		date: new Date().toISOString().slice(0, 10),
		meal: 'lunch',
		zone: 'Europe/Istanbul'
	});
	await page.goto('/recipes');
	await page.getByRole('link', { name: 'New recipe' }).click();
	await page.getByRole('button', { name: 'Add food' }).click();
	const sheet = page.getByRole('dialog', { name: 'Add a food' });
	await expect(sheet.getByRole('heading', { name: 'Recent' })).toBeVisible();
	await sheet.getByRole('button', { name: new RegExp(tag) }).click();
	await expect(page.getByRole('dialog', { name: new RegExp(tag) })).toBeVisible();
});

test('the serving size and its unit line up, with the hint under both', async ({
	page
}, testInfo) => {
	await signedInAs(page, `Hiza ${testInfo.project.name}`);
	await page.goto('/foods/new');
	await page.getByRole('radio', { name: 'per serving' }).click();
	const field = await page.getByLabel('Serving weight or volume (optional)').boundingBox();
	const unit = await page.getByRole('button', { name: 'Unit' }).boundingBox();
	expect(Math.abs(field!.y + field!.height - (unit!.y + unit!.height))).toBeLessThan(1);
});

test('opening a sheet does not put focus on its close button; Tab reaches it, Escape closes', async ({
	page
}, testInfo) => {
	await signedInAs(page, `Odak ${testInfo.project.name}`);
	await page.goto('/recipes');
	await page.getByRole('link', { name: 'New recipe' }).click();
	await page.getByRole('button', { name: 'Add food' }).click();
	const sheet = page.getByRole('dialog', { name: 'Add a food' });
	await expect(sheet).toBeFocused();
	const close = sheet.getByRole('button', { name: 'Close' });
	await expect(close).not.toBeFocused();
	await page.keyboard.press('Tab');
	await expect(close).toBeFocused();
	await page.keyboard.press('Escape');
	await expect(sheet).toBeHidden();

	// A sheet that opens straight into typing keeps its field focused.
	await page.goto('/log');
	await page.getByRole('button', { name: 'Type it' }).click();
	await expect(
		page.getByRole('dialog', { name: 'Type what you ate' }).getByLabel('You typed')
	).toBeFocused();
});

test('a long food name in a sheet title leaves the close button its full size', async ({
	page
}, testInfo) => {
	const tag = `Uzun ${testInfo.project.name}`;
	await signedInAs(page, tag);
	const name = `${tag} Geleneksel Taş Fırında Pişirilmiş Tam Buğdaylı Ekşi Mayalı Köy Ekmeği Dilimlenmiş`;
	const unbroken = `${tag} Çikolatalıfındıkkremalıgofretbisküvisütlüçikolatakaplamalı`;
	for (const n of [name, unbroken]) {
		await createFood(page, {
			name: n,
			brand: 'Uzunmarkaadıolanfırıncılık',
			basis: '100g',
			nutrients: [{ code: 'energy_kcal', value: 250, qualifier: 'reported' }],
			servings: []
		});
	}
	// Layout sizes, which the opening animation's scale doesn't change.
	const sizeOfClose = (sheet: ReturnType<Page['getByRole']>) =>
		sheet.getByRole('button', { name: 'Close' }).evaluate((close: HTMLElement) => {
			const dialog = close.closest('dialog')!;
			return {
				width: close.offsetWidth,
				height: close.offsetHeight,
				inside: close.getBoundingClientRect().right <= dialog.getBoundingClientRect().right
			};
		});

	for (const n of [name, unbroken]) {
		// The amount sheet on Log, which has its own head.
		await page.goto('/log');
		await page.getByRole('searchbox').first().fill(n.slice(0, 30));
		await page
			.getByRole('button', { name: new RegExp(n.slice(tag.length + 1, tag.length + 12)) })
			.first()
			.click();
		const amount = page.getByRole('dialog').last();
		await expect(amount).toBeVisible();
		expect(await sizeOfClose(amount)).toEqual({ width: 44, height: 44, inside: true });

		// Add a food in a recipe, whose title becomes the food's name.
		await page.goto('/recipes/new');
		await page.getByRole('button', { name: 'Add food' }).click();
		const add = page.getByRole('dialog', { name: 'Add a food' });
		await add.getByLabel('Search foods').fill(n.slice(0, 30));
		await add
			.getByRole('button', { name: new RegExp(n.slice(tag.length + 1, tag.length + 12)) })
			.first()
			.click();
		const picked = page.getByRole('dialog').last();
		await expect(picked.getByLabel('Amount')).toBeVisible();
		expect(await sizeOfClose(picked)).toEqual({ width: 44, height: 44, inside: true });
	}
});
