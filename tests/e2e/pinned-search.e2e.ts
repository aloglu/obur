import { expect, test, type Locator, type Page } from '@playwright/test';
import { apiAs, createFood, signedInAs } from './fixtures.ts';

const foodsNamed = async (page: Page, tag: string, count = 16) => {
	const ids: string[] = [];
	for (let i = 0; i < count; i++) {
		ids.push(
			await createFood(page, {
				name: `${tag} ${i}`,
				brand: null,
				basis: '100g',
				nutrients: [{ code: 'energy_kcal', value: 100, qualifier: 'reported' }],
				servings: []
			})
		);
	}
	return ids;
};

/** Scrolled to the end of the page, the field is still on screen and nothing has moved over it. */
async function staysOnPage(page: Page, field: Locator) {
	const before = await page.evaluate(() => window.scrollY);
	await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
	await expect.poll(() => page.evaluate(() => window.scrollY)).toBeGreaterThan(before + 100);
	await expect(field).toBeInViewport({ ratio: 1 });
	expect((await field.boundingBox())!.y).toBeLessThan(120);
	await field.click();
	await expect(field).toBeFocused();
}

test('the search stays while the list scrolls on Foods, Log and Help', async ({
	page
}, testInfo) => {
	const tag = `Sabit ${testInfo.project.name}`;
	await signedInAs(page, tag);
	await foodsNamed(page, tag);

	await page.goto('/foods');
	// Before scrolling it sits under the title, not over it.
	const heading = (await page.getByRole('heading', { level: 1, name: 'Foods' }).boundingBox())!;
	const search = page.getByLabel('Search foods');
	expect((await search.boundingBox())!.y).toBeGreaterThanOrEqual(heading.y + heading.height);
	await staysOnPage(page, search);

	await page.goto('/log');
	const logSearch = page.getByRole('searchbox').first();
	await logSearch.fill(tag);
	await expect(page.getByRole('button', { name: new RegExp(tag) })).toHaveCount(16);
	await staysOnPage(page, logSearch);

	await page.goto('/help');
	await staysOnPage(page, page.getByRole('searchbox'));
});

async function scrollSheet(sheet: Locator) {
	await sheet.evaluate((el) => el.scrollTo(0, el.scrollHeight));
	await expect.poll(() => sheet.evaluate((el) => el.scrollTop)).toBeGreaterThan(50);
}

test('in Add a food the title and search stay; only the list scrolls', async ({
	page
}, testInfo) => {
	const tag = `Liste ${testInfo.project.name}`;
	await signedInAs(page, tag);
	await foodsNamed(page, tag);
	await page.goto('/recipes');
	await page.getByRole('link', { name: 'New recipe' }).click();
	await page.getByRole('button', { name: 'Add food' }).click();
	const sheet = page.getByRole('dialog', { name: 'Add a food' });
	const search = sheet.getByLabel('Search foods');
	await search.fill(tag);
	await expect(sheet.getByRole('button', { name: new RegExp(tag) })).toHaveCount(16);
	await scrollSheet(sheet);

	const top = (await sheet.boundingBox())!.y;
	await expect(sheet.getByRole('heading', { name: 'Add a food' })).toBeInViewport({ ratio: 1 });
	await expect(search).toBeInViewport({ ratio: 1 });
	expect((await search.boundingBox())!.y - top).toBeLessThan(120);
	await search.click();
	await expect(search).toBeFocused();
});

test('Add a food opens small like any sheet, then grows smoothly to its list', async ({
	page
}, testInfo) => {
	const tag = `Açılış ${testInfo.project.name}`;
	await signedInAs(page, tag);
	for (const id of await foodsNamed(page, tag, 8)) {
		await apiAs(page, 'POST', '/api/v1/diary/entries', {
			kind: 'food',
			foodId: id,
			amount: 100,
			unit: { kind: 'mass', unit: 'g' },
			date: new Date().toISOString().slice(0, 10),
			meal: 'lunch',
			zone: 'Europe/Istanbul'
		});
	}
	const recentLoaded = page.waitForResponse('**/api/v1/diary/recent');
	await page.goto('/recipes');
	await page.getByRole('link', { name: 'New recipe' }).click();
	await recentLoaded;
	await expect(page.getByRole('button', { name: 'Add food' })).toBeVisible();

	// The height at the moment the slide-up ends, before the list is let in, and the height animation played after it.
	const { arrived, played, final } = await page.evaluate(async () => {
		const played: { from: string; to: string; duration: unknown }[] = [];
		const animate = Element.prototype.animate;
		Element.prototype.animate = function (frames, options) {
			const list = frames as { height?: string }[];
			if (list?.[0]?.height) {
				played.push({
					from: list[0].height,
					to: list[1].height!,
					duration: (options as KeyframeAnimationOptions).duration
				});
			}
			return animate.call(this, frames, options);
		};
		const slidIn = new Promise<number>((resolve) => {
			document.addEventListener(
				'animationend',
				function ended(e) {
					const el = e.target as HTMLElement;
					if (el.tagName !== 'DIALOG' || e.pseudoElement) return;
					document.removeEventListener('animationend', ended, true);
					resolve(el.offsetHeight);
				},
				true
			);
		});
		const button = [...document.querySelectorAll('button')].find((b) =>
			b.textContent?.includes('Add food')
		)!;
		button.click();
		const arrived = await slidIn;
		await new Promise((done) => setTimeout(done, 800));
		const final = document.querySelector<HTMLDialogElement>('dialog[open]')!.offsetHeight;
		return { arrived, played, final };
	});
	expect(arrived).toBeLessThan(240);
	expect(final).toBeGreaterThan(arrived + 200);
	expect(played).toEqual([{ from: `${arrived}px`, to: `${final}px`, duration: 340 }]);
});

test('searching inside an item in Type it keeps its search in view', async ({ page }, testInfo) => {
	const tag = `Yazı ${testInfo.project.name}`;
	await signedInAs(page, tag);
	await foodsNamed(page, tag, 20);
	await page.goto('/log');
	await page.getByRole('button', { name: 'Type it' }).click();
	const sheet = page.getByRole('dialog', { name: 'Type what you ate' });
	await sheet.getByLabel('You typed').fill('qqqqzzzz');
	await sheet.getByRole('button', { name: 'Search your foods' }).click();
	const search = sheet.getByRole('searchbox');
	await search.fill(tag);
	await expect(sheet.getByRole('button', { name: new RegExp(tag) }).first()).toBeVisible();
	await sheet
		.getByRole('button', { name: new RegExp(`${tag} `) })
		.nth(12)
		.scrollIntoViewIfNeeded();
	await expect(search).toBeInViewport({ ratio: 1 });
});
