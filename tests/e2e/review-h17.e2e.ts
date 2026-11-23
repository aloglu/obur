// Screenshots for the owner's review of H17 (Today's reading order on phones), not a test. Runs only with the marker
// file .review-shots: `touch .review-shots && npm run test:e2e -- review-h17 --project desktop-chromium`.
// Each option is applied to the real page with CSS and DOM moves; a number on each card is the order in which the
// Tab key and a screen reader reach it (the page's order).
import { existsSync, mkdirSync } from 'node:fs';
import { expect, test, type Page } from '@playwright/test';
import { e2eEnv } from '../../playwright.config.ts';
import { apiAs, createFood, signedInAs } from './fixtures.ts';

test.skip(!existsSync('.review-shots'), 'design review screenshots only on request');
test.skip(({ browserName }) => browserName !== 'chromium', 'one browser is enough');
test.setTimeout(300_000);

const OUT = 'test-results/review-h17';
const ZONE = 'Europe/Istanbul';
const SECTIONS = ['.o-budget', '.o-meals', '.o-nutrients', '.o-pair', '.o-note', '.o-done'];
type Option = 'now' | 'phone' | 'desktop';

async function seed(page: Page) {
	const today = await page.evaluate(() => new Date().toLocaleDateString('en-CA'));
	await apiAs(page, 'PATCH', '/api/v1/profile/details', {
		heightCm: 175,
		birthDate: '1990-06-02',
		sex: 'female'
	});
	await apiAs(page, 'POST', '/api/v1/body/weight', { date: today, zone: ZONE, value: 72.4 });
	await apiAs(page, 'POST', '/api/v1/targets', {
		mode: 'calculated',
		effectiveFrom: today,
		rateKgPerWeek: 0.5,
		goalWeightKg: 66
	});
	const food = (name: string, kcal: number, protein: number, carbs: number, fat: number) =>
		createFood(page, {
			name,
			basis: '100g',
			nutrients: [
				{ code: 'energy_kcal', value: kcal, qualifier: 'reported' },
				{ code: 'protein', value: protein, qualifier: 'reported' },
				{ code: 'carbohydrate_unspecified', value: carbs, qualifier: 'reported' },
				{ code: 'fat', value: fat, qualifier: 'reported' }
			]
		});
	const entry = (foodId: string, grams: number, meal: string) =>
		apiAs(page, 'POST', '/api/v1/diary/entries', {
			kind: 'food',
			date: today,
			meal,
			zone: ZONE,
			foodId,
			amount: grams,
			unit: { kind: 'mass', unit: 'g' }
		});
	const oats = await food('Rolled oats', 379, 13, 66, 7);
	const yogurt = await food('Greek yogurt', 97, 9, 4, 5);
	const chicken = await food('Chicken breast, grilled', 165, 31, 0, 3.6);
	const rice = await food('Brown rice, cooked', 123, 2.7, 26, 1);
	const apple = await food('Apple', 52, 0.3, 14, 0.2);
	await entry(oats, 50, 'breakfast');
	await entry(yogurt, 150, 'breakfast');
	await entry(chicken, 140, 'lunch');
	await entry(rice, 180, 'lunch');
	await entry(apple, 160, 'snacks');
	for (const ml of [250, 500])
		await apiAs(page, 'POST', '/api/v1/body/water', { date: today, zone: ZONE, value: ml });
}

/** Applies an option to the page as it would be built. */
async function apply(page: Page, option: Option) {
	await page.evaluate((option) => {
		const style = document.createElement('style');
		if (option === 'phone') {
			// Option 1: on phones the cards show in the page's own order: Meals right after the budget.
			style.textContent = `@media (max-width: 759px) {
				.o-budget { order: 1 !important } .o-meals { order: 2 !important } .o-nutrients { order: 3 !important }
				.o-pair { order: 4 !important } .o-note { order: 5 !important } .o-done { order: 6 !important } }`;
		}
		if (option === 'desktop') {
			// Option 2: the page's order becomes the phone's (Meals after Water and Weight); on desktop the cards are
			// placed in two columns that share rows.
			const meals = document.querySelector('.o-meals')!;
			const note = document.querySelector('.o-note')!;
			note.parentElement!.insertBefore(meals, note);
			style.textContent = `@media (min-width: 760px) {
				.today .today-a, .today .today-b { display: contents !important }
				.today > header { grid-row: 1 }
				.o-budget { grid-column: 1; grid-row: 2 } .o-nutrients { grid-column: 2; grid-row: 2 }
				.o-meals { grid-column: 1; grid-row: 3 / span 3 } .o-pair { grid-column: 2; grid-row: 3 }
				.o-note { grid-column: 2; grid-row: 4 } .o-done { grid-column: 2; grid-row: 5 } }`;
		}
		document.head.append(style);
	}, option);
	await page.waitForTimeout(300);
	// The reading order: the order of the cards in the page.
	await page.evaluate((selectors) => {
		const all = [...document.querySelectorAll<HTMLElement>(selectors.join(','))];
		all.forEach((el, i) => {
			const r = el.getBoundingClientRect();
			const badge = document.createElement('div');
			badge.textContent = String(i + 1);
			Object.assign(badge.style, {
				position: 'absolute',
				left: `${r.left + window.scrollX - 6}px`,
				top: `${r.top + window.scrollY - 6}px`,
				width: '30px',
				height: '30px',
				borderRadius: '50%',
				background: '#d6249f',
				color: '#fff',
				font: '700 16px/30px system-ui, sans-serif',
				textAlign: 'center',
				zIndex: '100',
				boxShadow: '0 0 0 3px #fff'
			});
			document.body.append(badge);
		});
	}, SECTIONS);
}

for (const [device, viewport] of [
	['phone', { width: 390, height: 844 }],
	['desktop', { width: 1280, height: 900 }]
] as const) {
	test(`H17 review (${device})`, async ({ page, context }) => {
		mkdirSync(OUT, { recursive: true });
		await page.setViewportSize(viewport);
		await signedInAs(page, `Alex Morgan ${device}`);
		await context.addCookies([
			{ name: 'obur_theme', value: 'light', url: e2eEnv.PUBLIC_ORIGIN },
			{ name: 'obur_zone', value: ZONE, url: e2eEnv.PUBLIC_ORIGIN }
		]);
		await seed(page);
		for (const option of ['now', 'phone', 'desktop'] as const) {
			await page.goto('/');
			await expect(page.getByRole('region', { name: 'Budget' })).toContainText('kcal');
			await page.waitForLoadState('networkidle').catch(() => {});
			await page.waitForTimeout(700);
			// Toasts and the phone's tab bar (fixed, it would sit in the middle of a whole-page picture) are left out.
			await page.evaluate(() => {
				document.querySelectorAll('[role="status"] > *').forEach((e) => e.remove());
				if (innerWidth < 760)
					document
						.querySelectorAll<HTMLElement>('[data-tabbar]')
						.forEach((e) => (e.style.display = 'none'));
			});
			await apply(page, option);
			await page.screenshot({
				path: `${OUT}/${device}-${option}.jpg`,
				type: 'jpeg',
				quality: 85,
				fullPage: true
			});
		}
	});
}
