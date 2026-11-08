import { expect, test } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { apiAs, createFood, signedInAs } from './fixtures.ts';

test.setTimeout(600_000);
// Automated checks (axe, WCAG 2.2 A and AA) on every signed-in page, light and dark. They supplement keyboard and
// screen-reader checks rather than prove accessibility (docs/design.md, "Testing and definition of done").
test('every page passes the automated accessibility checks in light and dark', async ({
	page
}, info) => {
	test.skip(info.project.name !== 'phone-webkit', 'one browser is enough');
	await signedInAs(page, 'Gülşen Karaosmanoğlu', 'admin');
	await page.goto('/');
	const today = await page.evaluate(() => new Date().toLocaleDateString('en-CA'));
	const food = await createFood(page, {
		name: 'Ev yapımı mercimek çorbası',
		basis: '100g',
		nutrients: [{ code: 'energy_kcal', value: 92, qualifier: 'reported' }]
	});
	await apiAs(page, 'POST', '/api/v1/diary/entries', {
		kind: 'food',
		foodId: food,
		amount: 250,
		unit: { kind: 'mass', unit: 'g' },
		date: today,
		meal: 'lunch',
		zone: 'Europe/Istanbul'
	});
	await apiAs(page, 'POST', '/api/v1/body/weight', {
		id: crypto.randomUUID(),
		date: today,
		zone: 'Europe/Istanbul',
		value: 72.4
	});
	const pages = [
		'/',
		'/log',
		'/journal',
		'/progress',
		'/achievements',
		'/more',
		'/more/settings',
		'/more/appearance',
		'/more/units',
		'/more/speak-and-scan',
		'/more/goal',
		'/more/deleted',
		'/profile',
		'/foods',
		'/foods/new',
		`/foods/${food}`,
		'/recipes',
		'/recipes/new',
		'/saved-meals',
		'/saved-meals/new',
		'/scan',
		'/settings/data',
		'/settings/reminders',
		'/settings/security',
		'/household',
		'/help',
		'/onboarding'
	];
	const out: string[] = [];
	for (const dark of [false, true]) {
		await page.emulateMedia({ colorScheme: dark ? 'dark' : 'light', reducedMotion: 'reduce' });
		for (const path of pages) {
			await page.goto(path);
			await page.waitForLoadState('networkidle').catch(() => {});
			await page.waitForTimeout(300);
			await page.evaluate(async () => {
				await document.fonts.ready;
				await Promise.all(document.getAnimations().map((x) => x.finished.catch(() => {})));
			});
			const check = () =>
				new AxeBuilder({ page })
					.withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'])
					.analyze();
			let r = await check();
			// Under load a page can be caught mid-paint; a real problem is still there a second later.
			if (r.violations.length) {
				await page.waitForTimeout(1000);
				r = await check();
			}
			for (const v of r.violations)
				out.push(
					`${dark ? 'dark' : 'light'} ${path} [${v.impact}] ${v.id}: ${v.help}\n   ${v.nodes
						.slice(0, 3)
						.map(
							(n) =>
								n.target.join(' ') +
								' :: ' +
								(n.failureSummary ?? '').split('\n').slice(1, 2).join('')
						)
						.join('\n   ')}`
				);
		}
	}
	expect(out, out.join('\n')).toEqual([]);
});
