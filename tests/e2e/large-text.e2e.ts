import { expect, test } from '@playwright/test';
import { createFood, signedInAs } from './fixtures.ts';

// obur follows the iPhone's text size (static/text-scale.js): the system body font, 17 px at the standard size, sets
// the root size, capped at 200 %, and large text switches side-by-side layouts to one column.
test('an iPhone set to its largest text gets text at 200 %, and the pages still fit the screen', async ({
	page
}, testInfo) => {
	test.skip(testInfo.project.name !== 'phone-webkit', 'one phone is enough');
	// The phone as WebKit on an iPhone reports it with the largest accessibility text.
	await page.addInitScript(() => {
		const supports = CSS.supports.bind(CSS);
		CSS.supports = ((a: string, b?: string) =>
			(a === 'font' && b === '-apple-system-body') ||
			(a === '-webkit-touch-callout' && b === 'none')
				? true
				: b === undefined
					? supports(a)
					: supports(a, b)) as typeof CSS.supports;
		const computed = window.getComputedStyle.bind(window);
		window.getComputedStyle = ((el: Element, pseudo?: string | null) => {
			const style = computed(el, pseudo);
			// The script's probe: a span placed straight under <html>.
			if (el instanceof HTMLSpanElement && el.parentElement === document.documentElement)
				return new Proxy(style, { get: (t, k) => (k === 'fontSize' ? '53px' : Reflect.get(t, k)) });
			return style;
		}) as typeof window.getComputedStyle;
	});
	await signedInAs(page, `Büyük yazı ${testInfo.project.name}`, 'admin');
	await createFood(page, {
		name: 'Ev yapımı kırmızı mercimek çorbası',
		basis: '100g',
		nutrients: [{ code: 'energy_kcal', value: 92, qualifier: 'reported' }]
	});
	await page.goto('/');
	const root = page.locator('html');
	await expect(root).toHaveAttribute('data-text', 'large');
	expect(await page.evaluate(() => getComputedStyle(document.documentElement).fontSize)).toBe(
		'32px'
	);

	for (const path of [
		'/',
		'/log',
		'/progress',
		'/journal',
		'/more',
		'/more/appearance',
		'/foods/new',
		'/household',
		'/profile'
	]) {
		await page.goto(path);
		await page.waitForLoadState('networkidle');
		const wide = await page.evaluate(
			() => document.documentElement.scrollWidth - document.documentElement.clientWidth
		);
		expect(wide, `${path} runs past the screen`).toBeLessThanOrEqual(1);
	}
});

test('at the standard size nothing changes', async ({ page }, testInfo) => {
	test.skip(testInfo.project.name !== 'phone-webkit', 'one phone is enough');
	await signedInAs(page, `Normal yazı ${testInfo.project.name}`);
	await page.goto('/');
	await expect(page.locator('html')).not.toHaveAttribute('data-text');
	expect(await page.evaluate(() => getComputedStyle(document.documentElement).fontSize)).toBe(
		'16px'
	);
});
