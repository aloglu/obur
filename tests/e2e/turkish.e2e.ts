// The app in Turkish (docs/design.md, "Interface language"):
// Today with long Turkish names, a built-in food and a budget with activity, in pictures; every main screen without
// sideways scrolling; built-in names, dates and decimal commas as the plan says.
import { expect, test, type Page } from '@playwright/test';
import { e2eEnv } from '../../playwright.config.ts';
import { apiAs, createFood, signedInAs } from './fixtures.ts';

const ZONE = 'Europe/Istanbul';
const isPhone = (page: Page) => (page.viewportSize()?.width ?? 1000) < 760;

async function inTurkish(page: Page, name: string) {
	await signedInAs(page, name);
	await apiAs(page, 'PATCH', '/api/v1/profile/preferences', { language: 'tr' });
	await page
		.context()
		.addCookies([{ name: 'obur_lang', value: 'tr', url: e2eEnv.PUBLIC_ORIGIN, sameSite: 'Lax' }]);
}

async function seedDay(page: Page, date: string) {
	await apiAs(page, 'POST', '/api/v1/targets', {
		mode: 'manual',
		effectiveFrom: '2026-10-01',
		budgetKcal: 2150
	});
	const corba = await createFood(page, {
		name: 'Kırmızı mercimek çorbası (bol limonlu, kıtır ekmekli, nane yağlı)',
		brand: 'Anneannemin Mutfağı Şarküteri',
		basis: '100g',
		nutrients: [
			{ code: 'energy_kcal', value: 92, qualifier: 'reported' },
			{ code: 'protein', value: 5.5, qualifier: 'reported' }
		]
	});
	const { results } = await apiAs<{ results: { id: string; name: string }[] }>(
		page,
		'GET',
		'/api/v1/foods?q=feta'
	);
	const feta = results.find((r) => r.name === 'Feta cheese')!;
	const entry = (foodId: string, meal: string, amount: number) =>
		apiAs(page, 'POST', '/api/v1/diary/entries', {
			date,
			zone: ZONE,
			kind: 'food',
			meal,
			foodId,
			amount,
			unit: { kind: 'mass', unit: 'g' }
		});
	await entry(feta.id, 'breakfast', 40);
	await entry(corba, 'lunch', 300);
	await apiAs(page, 'POST', '/api/v1/diary/entries', {
		date,
		zone: ZONE,
		kind: 'quick',
		meal: 'snacks',
		kcal: 280,
		description: 'Simit'
	});
	await apiAs(page, 'POST', '/api/v1/body/weight', { date, zone: ZONE, value: 72.5 });
	await apiAs(page, 'POST', '/api/v1/body/activity', {
		date,
		zone: ZONE,
		value: 1250,
		kind: 'extra'
	});
}

for (const theme of ['light', 'dark'] as const) {
	test(`Today in Turkish (${theme})`, async ({ page, context }, testInfo) => {
		await inTurkish(page, `Ayşe Yılmaz ${testInfo.project.name} ${theme}`);
		await context.addCookies([{ name: 'obur_theme', value: theme, url: e2eEnv.PUBLIC_ORIGIN }]);
		const date = '2026-10-20';
		await seedDay(page, date);
		await page.goto(`/?date=${date}`);
		await expect(page.getByRole('heading', { level: 1, name: '20 Ekim' })).toBeVisible();
		// The budget card's activity pill keeps its word (owner, 2026-11-14) and its line.
		const budget = page.getByRole('region', { name: 'Bütçe' });
		await expect(budget.getByRole('button', { name: 'Aktivite ekle' })).toContainText('Aktivite');
		const [pill, left] = await Promise.all([
			budget.getByRole('button', { name: 'Aktivite ekle' }).boundingBox(),
			budget.getByText('kcal kaldı').boundingBox()
		]);
		expect(Math.abs(pill!.y - left!.y)).toBeLessThan(24);
		// A built-in food in Turkish; a typed name as typed; a decimal comma.
		await expect(page.getByText('Feta peyniri')).toBeVisible();
		await expect(page.getByText('Kırmızı mercimek çorbası', { exact: false })).toBeVisible();
		await expect(page.getByRole('region', { name: 'Kilo' })).toContainText('72,5');
		await page.evaluate(() => document.fonts.ready);
		await expect(page).toHaveScreenshot(`today-tr-${theme}.png`, {
			fullPage: !isPhone(page),
			animations: 'disabled'
		});
		if (isPhone(page))
			await expect(page.getByRole('region', { name: 'Öğle yemeği' })).toHaveScreenshot(
				`lunch-tr-${theme}.png`,
				{ animations: 'disabled' }
			);
	});
}

test('no main screen scrolls sideways in Turkish', async ({ page }) => {
	await inTurkish(page, 'Mehmet Öztürk Uzunsoyadlıoğulları');
	await seedDay(page, '2026-10-20');
	for (const path of [
		'/?date=2026-10-20',
		'/log',
		'/journal',
		'/progress',
		'/more',
		'/more/settings',
		'/more/units',
		'/more/appearance',
		'/more/goal',
		'/profile',
		'/settings/data',
		'/settings/security',
		'/settings/reminders',
		'/more/speak-and-scan',
		'/foods',
		'/recipes',
		'/saved-meals',
		'/more/deleted',
		'/help',
		'/achievements'
	]) {
		await page.goto(path);
		await expect(page.locator('html')).toHaveAttribute('lang', 'tr');
		const wide = await page.evaluate(
			() => document.documentElement.scrollWidth - document.documentElement.clientWidth
		);
		expect(wide, path).toBeLessThanOrEqual(0);
	}
});

test('dates, numbers and built-in portions read as Turkish', async ({ page }) => {
	await inTurkish(page, 'Zeynep Kaya');
	await page.goto('/log');
	await page.getByRole('searchbox', { name: 'Yiyecek ara' }).fill('muz');
	await page.getByRole('button', { name: /^Muz/ }).click();
	const sheet = page.getByRole('dialog', { name: 'Muz' });
	await sheet.getByRole('button', { name: /^Birim:/ }).click();
	await expect(page.getByRole('option', { name: /^orta boy \(18–20 cm\)/ })).toBeVisible();
	await page.keyboard.press('Escape');
	await page.goto('/journal');
	await expect(page.getByRole('heading', { level: 1, name: 'Takvim' })).toBeVisible();
	await expect(page.getByText(/Kasım 2026|Ekim 2026|Aralık 2026/).first()).toBeVisible();
});

test('typed Turkish portions find a built-in food’s portion: “diş”, “yemek kaşığı”', async ({
	page
}) => {
	await signedInAs(page, 'Porsiyon Deneyen');
	const parse = (text: string) =>
		apiAs<{
			items: {
				food: { name: string; servings: { id: string; name: string }[] } | null;
				amount: number | null;
				unit: { kind: string; servingId?: string } | null;
			}[];
		}>(page, 'POST', '/api/v1/entry/parse', { text, date: '2026-11-14', zone: ZONE });
	const portionOf = async (text: string) => {
		const [item] = (await parse(text)).items;
		const serving = item.food?.servings.find((s) => s.id === item.unit?.servingId);
		return { food: item.food?.name, amount: item.amount, portion: serving?.name };
	};
	expect(await portionOf('iki diş sarımsak')).toEqual({
		food: 'Garlic',
		amount: 2,
		portion: 'clove'
	});
	expect(await portionOf('1 yemek kaşığı zeytinyağı')).toEqual({
		food: 'Olive oil',
		amount: 1,
		portion: 'tablespoon'
	});
	expect(await portionOf('2 cloves garlic')).toEqual({
		food: 'Garlic',
		amount: 2,
		portion: 'clove'
	});
});

test('logging in Turkish: short meal choices, the meal first on the button, macros apart (owner, 2026-11-14)', async ({
	page
}, testInfo) => {
	const tag = testInfo.project.name.replace(/[^a-z]/gi, '');
	await inTurkish(page, `Elif ${tag}`);
	await createFood(page, {
		name: `Protein Bar ${tag}`,
		brand: 'Fellas',
		basis: '100g',
		nutrients: [
			{ code: 'energy_kcal', value: 378, qualifier: 'reported' },
			{ code: 'protein', value: 42, qualifier: 'reported' },
			{ code: 'carbohydrate_excl_fibre', value: 12, qualifier: 'reported' },
			{ code: 'fat', value: 11, qualifier: 'reported' }
		],
		servings: [{ name: 'Bar', amount: 50, unit: 'g' }]
	});
	await page.goto('/log');
	await page.getByRole('button', { name: 'Yaz', exact: true }).click();
	const sheet = page.getByRole('dialog', { name: 'Ne yediğini yaz' });
	await sheet.getByLabel('Yazdığın').fill(`öğle yemeğinde bir bar protein bar ${tag}`);
	await expect(sheet.getByRole('radio', { name: 'Öğle', exact: true })).toBeChecked();
	await expect(sheet.getByRole('radio', { name: 'Akşam', exact: true })).toBeVisible();
	await expect(sheet.getByRole('button', { name: 'Öğle yemeğine 1 yiyecek kaydet' })).toBeVisible();
	await sheet.getByRole('radio', { name: 'Ara öğün' }).click();
	await expect(sheet.getByRole('button', { name: 'Ara öğüne 1 yiyecek kaydet' })).toBeVisible();

	// The amount's macro labels sit side by side without running into each other.
	await sheet
		.getByRole('region', { name: `Fellas Protein Bar ${tag}` })
		.getByRole('button', { name: /^Düzenle/ })
		.click();
	const labels = sheet.locator('dl dt');
	await expect(labels).toHaveCount(3);
	const boxes = await labels.evaluateAll((dts) =>
		dts.map((dt) => {
			const r = dt.getBoundingClientRect();
			return { left: r.left, right: dt.getBoundingClientRect().left + dt.scrollWidth };
		})
	);
	for (let i = 1; i < boxes.length; i++)
		expect(boxes[i - 1].right).toBeLessThanOrEqual(boxes[i].left);
	await expect(labels.nth(1)).toContainText('Karbonhidrat'); // for screen readers
});
