// Screenshots for the owner's review of A43 (unknown calories), not a test. Runs only with the marker file
// .review-shots: `touch .review-shots && npm run test:e2e -- review-a43 --project desktop-chromium`.
import { existsSync, mkdirSync } from 'node:fs';
import { test, type Page } from '@playwright/test';
import { e2eEnv } from '../../playwright.config.ts';
import { apiAs, createFood, signedInAs, withoutCalories } from './fixtures.ts';

test.skip(!existsSync('.review-shots'), 'design review screenshots only on request');
test.skip(({ browserName }) => browserName !== 'chromium', 'one browser is enough');
test.use({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });
test.setTimeout(240_000);

const OUT = 'test-results/review-a43';
const ZONE = 'Europe/Istanbul';

async function shot(page: Page, name: string, theme: string) {
	await page.waitForLoadState('networkidle').catch(() => {});
	await page.waitForTimeout(600);
	// Celebration toasts would cover the page.
	await page.evaluate(() =>
		document.querySelectorAll('[role="status"] > *').forEach((e) => e.remove())
	);
	await page.screenshot({ path: `${OUT}/${name}-${theme}.jpg`, type: 'jpeg', quality: 85 });
}

/** Shows the page as main draws it today: no "+", "?" or note (the only differences on this branch). */
async function asToday(page: Page, eaten: string, left?: string) {
	await page.evaluate(
		({ eaten, left }) => {
			document.querySelector('[data-testid="budget-unknown"]')?.remove();
			const card = document.querySelector('section[aria-label]');
			for (const b of card?.querySelectorAll('b') ?? [])
				if (/^(\d[\d,]*\+|\?)$/.test(b.textContent!.trim())) b.textContent = eaten;
			if (left)
				for (const sp of card?.querySelectorAll('span') ?? [])
					if (sp.textContent!.trim() === '?') sp.textContent = left;
		},
		{ eaten, left }
	);
}

async function noPlus(page: Page) {
	await page.evaluate(() => {
		const walk = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
		for (let n = walk.nextNode(); n; n = walk.nextNode())
			if (n.textContent === '+') n.textContent = '';
			else if (/^\d[\d,]*\+$/.test(n.textContent!.trim()))
				n.textContent = n.textContent!.replace('+', '');
	});
}

for (const theme of ['light', 'dark'] as const) {
	test(`A43 screens (${theme})`, async ({ page, context }) => {
		mkdirSync(OUT, { recursive: true });
		await signedInAs(page, 'Sam Carter', 'admin');
		await context.addCookies([
			{ name: 'obur_theme', value: theme, url: e2eEnv.PUBLIC_ORIGIN },
			{ name: 'obur_zone', value: ZONE, url: e2eEnv.PUBLIC_ORIGIN }
		]);
		const today = await page.evaluate(() => new Date().toLocaleDateString('en-CA'));
		await apiAs(page, 'PATCH', '/api/v1/profile/details', {
			heightCm: 178,
			birthDate: '1992-04-12',
			sex: 'male'
		});
		const yesterday = await page.evaluate(() => {
			const d = new Date();
			d.setDate(d.getDate() - 1);
			return d.toLocaleDateString('en-CA');
		});
		await apiAs(page, 'POST', '/api/v1/body/weight', { date: yesterday, zone: ZONE, value: 84.6 });
		await apiAs(page, 'POST', '/api/v1/targets', {
			mode: 'calculated',
			effectiveFrom: yesterday,
			rateKgPerWeek: 0.5,
			goalWeightKg: 78
		});
		const oats = await createFood(page, {
			name: 'Rolled oats',
			basis: '100g',
			nutrients: [
				{ code: 'energy_kcal', value: 379, qualifier: 'reported' },
				{ code: 'protein', value: 13, qualifier: 'reported' }
			]
		});
		const granola = await createFood(page, {
			name: 'Homemade granola',
			basis: '100g',
			nutrients: [{ code: 'energy_kcal', value: 450, qualifier: 'reported' }]
		});
		const log = (food: string, amount: number, meal: string, date = today) =>
			apiAs<{ id: string }>(page, 'POST', '/api/v1/diary/entries', {
				kind: 'food',
				foodId: food,
				amount,
				unit: { kind: 'mass', unit: 'g' },
				date,
				meal,
				zone: ZONE
			});
		// Yesterday: everything known. Today: oats known, granola imported without calories.
		await log(oats, 80, 'breakfast', yesterday);
		await log(oats, 120, 'breakfast');
		const unknown = await log(granola, 60, 'snacks');
		await withoutCalories(unknown.id);
		for (const d of [yesterday, today])
			await apiAs(page, 'PUT', `/api/v1/diary/days/${d}`, { complete: true });

		await page.goto('/');
		await shot(page, '1-today-partial-note', theme);
		await page.evaluate(() => document.querySelector('[data-testid="budget-unknown"]')?.remove());
		await shot(page, '2-today-partial-plain', theme);
		await asToday(page, '455');
		await shot(page, '2-today-partial-now', theme);
		await page.goto(`/journal?day=${today}`);
		await shot(page, '4-journal-partial', theme);
		await noPlus(page);
		await shot(page, '4-journal-now', theme);
		await page.goto('/progress');
		await page.getByRole('tab', { name: 'Calories' }).click();
		await shot(page, '5-progress', theme);
		await noPlus(page);
		await shot(page, '5-progress-now', theme);
		// Only the entry without calories left: the total is unknown.
		const day = await apiAs<{
			entries: { id: string; description?: string; food?: { name: string } }[];
		}>(page, 'GET', `/api/v1/diary/${today}`);
		for (const e of day.entries)
			if (e.id !== unknown.id)
				await apiAs(page, 'POST', `/api/v1/diary/entries/${e.id}?action=delete`, {});
		await page.goto('/');
		await shot(page, '3-today-unknown', theme);
		await asToday(page, '0', '1602');
		await shot(page, '3-today-unknown-now', theme);
	});
}
