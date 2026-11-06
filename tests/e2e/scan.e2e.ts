import { expect, test, type Page } from '@playwright/test';
import { SPEECH_STUB } from '../../playwright.config.ts';
import { scanEditsFor, signedInAs, choose } from './fixtures.ts';

const isPhone = (page: Page) => (page.viewportSize()?.width ?? 1000) < 760;
// Small images: the stand-in OCR answers by the photo's width (3, 5, 7 or 9 px), so each test gets its own made-up
// table even while both browsers run at once. A width's answer is never changed while the other browser may use it.
const png = (b64: string) => Buffer.from(b64, 'base64');
const WIDE3 = png(
	'iVBORw0KGgoAAAANSUhEUgAAAAMAAAACCAIAAAASFvFNAAAADklEQVR4nGP4DwMMcBYAs2AR7za3GVIAAAAASUVORK5CYII='
);
const WIDE7 = png(
	'iVBORw0KGgoAAAANSUhEUgAAAAcAAAACCAIAAAAb/VE3AAAAD0lEQVR4nGP4jw0wYBUFAJi9KdeqIjuUAAAAAElFTkSuQmCC'
);
const WIDE5 = png(
	'iVBORw0KGgoAAAANSUhEUgAAAAUAAAACCAIAAAAfCIEKAAAADklEQVR4nGP4jwoY0PgA3k8d47BbHWEAAAAASUVORK5CYII='
);
const WIDE9 = png(
	'iVBORw0KGgoAAAANSUhEUgAAAAkAAAACCAAAAACvPakPAAAAEElEQVQI12NsYIACJhiDAQAJvACEagAT+QAAAABJRU5ErkJggg=='
);
const line = (text: string, x: number, y: number, w = text.length * 8) => ({
	text,
	box: [
		[x, y],
		[x + w, y],
		[x + w, y + 20],
		[x, y + 20]
	],
	score: 0.95
});
const TABLE = [
	line('Enerji ve', 100, 60),
	line('Besin Öğeleri', 100, 82),
	line('100 g', 300, 60, 50),
	line('için', 300, 82, 40),
	line('1 porsiyon', 400, 60, 80),
	line('için (30 g)', 400, 82, 80),
	line('%RA*', 520, 70, 40),
	...[
		['Enerji (kJ ve kcal)', '1673/400', '502/120', '%20'],
		['Yağ (g)', '18', '5,4', '%26'],
		['- Doymuş yağ (g)', '2,5', '0,8', '%13'],
		['Karbonhidrat (g)', '52', '15,6', '%20'],
		['-Şekerler (g)', '24', '7,2', '%27'],
		['Protein (g)', '6,5', '2', '%13'],
		['Tuz (g)', '<0,1', '<0,1', '%1']
	].flatMap(([name, a, b, c], i) => [
		line(name, 100, 120 + i * 26),
		line(a, 300, 120 + i * 26, 60),
		line(b, 400, 120 + i * 26, 60),
		line(c, 520, 120 + i * 26, 40)
	])
];

test('scan a label: the proposal fills the food form, the person checks and names it, then logs it', async ({
	page,
	request
}, testInfo) => {
	await signedInAs(page, `Tarayıcı ${testInfo.project.name}`);
	await request.post(`${SPEECH_STUB}/next-ocr`, {
		data: { width: 3, status: 200, body: { lines: TABLE, ocrMs: 900, queueMs: 0 } }
	});
	await page.goto(isPhone(page) ? '/log' : '/');
	await page.getByRole('link', { name: 'Scan a label' }).click();
	await page.waitForLoadState('networkidle'); // the file input has no handler until the page is ready
	await page.getByLabel('Choose photo').setInputFiles({
		name: 'label.png',
		mimeType: 'image/png',
		buffer: WIDE3
	});
	await expect(page.getByText('Check every value against the photo')).toBeVisible();
	// The photo went out small and as JPEG (drawn again on the phone, which drops its location data).
	const sent = await (await request.get(`${SPEECH_STUB}/last-ocr`)).json();
	expect(sent).toMatchObject({ jpeg: true, width: 3 });
	await expect(page.getByRole('img', { name: 'Your photo of the label' })).toBeVisible();

	// Values per 100 g from the table, the bound kept, the serving offered as a portion; the name is typed.
	await expect(page.locator('#n-energy_kcal')).toHaveValue('400');
	await expect(page.locator('#n-fat')).toHaveValue('18');
	await expect(page.locator('#n-carbohydrate')).toHaveValue('52');
	await expect(page.locator('#n-salt')).toHaveValue('0,1');
	await expect(
		page.locator('#n-salt').locator('..').getByRole('checkbox', { name: 'Less than' })
	).toBeChecked();
	await page.getByLabel('Product name').fill(`Fındıklı gofret ${testInfo.project.name}`);
	await page.getByRole('button', { name: 'Save food' }).click();

	// Saved, then straight to the amount sheet in Log; nothing is logged until Save there.
	const sheet = page.getByRole('dialog', {
		name: new RegExp(`Fındıklı gofret ${testInfo.project.name}`)
	});
	await expect(sheet).toBeVisible();
	await choose(sheet, 'Unit', 'porsiyon (30 g)');
	await sheet.getByRole('button', { name: 'Save', exact: true }).click();
	await expect(page.getByRole('heading', { level: 1, name: 'Today' })).toBeVisible();
	await expect(page.getByRole('main')).toContainText(`Fındıklı gofret ${testInfo.project.name}`);
	// Saved as proposed: the form added and changed nothing on its own.
	expect(await scanEditsFor(`Fındıklı gofret ${testInfo.project.name}`)).toMatchObject({
		proposed: 8,
		changed: 0,
		removed: 0,
		added: 0,
		basis_known: true,
		basis_changed: false
	});
});

test('a label that cannot be read says so and leaves the form empty to fill in', async ({
	page,
	request
}, testInfo) => {
	await signedInAs(page, `Boş ${testInfo.project.name}`);
	await request.post(`${SPEECH_STUB}/next-ocr`, {
		data: { width: 5, status: 200, body: { lines: [line('Net Miktar: 400 g', 20, 40)], ocrMs: 1 } }
	});
	await page.goto(isPhone(page) ? '/log' : '/');
	await page.getByRole('link', { name: 'Scan a label' }).click();
	await page.waitForLoadState('networkidle'); // the file input has no handler until the page is ready
	await page
		.getByLabel('Choose photo')
		.setInputFiles({ name: 'x.png', mimeType: 'image/png', buffer: WIDE5 });
	await expect(page.getByText('No nutrition table could be read.')).toBeVisible();
	await expect(page.locator('#n-energy_kcal')).toHaveValue('');
	await request.post(`${SPEECH_STUB}/next-ocr`, {
		data: { width: 9, status: 503, body: { error: 'busy' } }
	});
	await page
		.getByLabel('Choose photo')
		.setInputFiles({ name: 'x.png', mimeType: 'image/png', buffer: WIDE9 });
	await expect(page.getByText('The server is reading other labels.')).toBeVisible();
});

test('scanning several labels in a row: saving can stay on Scan instead of opening Log', async ({
	page,
	request
}, testInfo) => {
	await signedInAs(page, `Toplu ${testInfo.project.name}`, 'admin');
	await request.post(`${SPEECH_STUB}/next-ocr`, {
		data: { width: 7, status: 200, body: { lines: TABLE, ocrMs: 1 } }
	});
	await page.goto(isPhone(page) ? '/log' : '/');
	await page.getByRole('link', { name: 'Scan a label' }).click();
	await page.waitForLoadState('networkidle'); // the file input has no handler until the page is ready
	const choose = () =>
		page
			.getByLabel('Choose photo')
			.setInputFiles({ name: 'x.png', mimeType: 'image/png', buffer: WIDE7 });
	await choose();
	await page.getByLabel('Log it after saving').uncheck();
	await page.getByLabel('Product name').fill(`Gofret 1 ${testInfo.project.name}`);
	await page.getByRole('button', { name: 'Save food' }).click();
	await expect(page.getByText(`Saved “Gofret 1 ${testInfo.project.name}”`)).toBeVisible();
	await expect(page.getByRole('heading', { level: 1, name: 'Scan a label' })).toBeVisible();
	await expect(page.getByLabel('Product name')).toBeHidden();
	await expect(page.getByRole('dialog')).toHaveCount(0);
	// The choice is remembered on this device.
	await page.goto(isPhone(page) ? '/log' : '/');
	await page.getByRole('link', { name: 'Scan a label' }).click();
	await page.waitForLoadState('networkidle'); // the file input has no handler until the page is ready
	await choose();
	await expect(page.getByLabel('Log it after saving')).not.toBeChecked();
	// One value corrected before saving is counted as one change; admins see household totals.
	await page.locator('#n-energy_kcal').fill('410');
	await page.getByLabel('Product name').fill(`Gofret 2 ${testInfo.project.name}`);
	await page.getByRole('button', { name: 'Save food' }).click();
	await expect(page.getByText(`Saved “Gofret 2 ${testInfo.project.name}”`)).toBeVisible();
	expect(await scanEditsFor(`Gofret 2 ${testInfo.project.name}`)).toMatchObject({
		changed: 1,
		removed: 0,
		added: 0
	});
	await page.goto('/household');
	await expect(page.getByTestId('scan-totals')).toContainText('Labels saved');
});
