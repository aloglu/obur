import { expect, test } from '@playwright/test';
import { SPEECH_STUB } from '../../playwright.config.ts';
import { scanEditsFor, signedInAs } from './fixtures.ts';

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
const WIDE11 = png(
	'iVBORw0KGgoAAAANSUhEUgAAAAsAAAACCAIAAAABwbG5AAAAFUlEQVR4nGP8//8/A17AhF+agYEBAMYGAwEg+6h9AAAAAElFTkSuQmCC'
);
const WIDE13 = png(
	'iVBORw0KGgoAAAANSUhEUgAAAA0AAAACCAIAAAAM38H+AAAAFUlEQVR4nGP8//8/AxGAiRhFDAwMAOoGAwGBrJxEAAAAAElFTkSuQmCC'
);
const WIDE15 = png(
	'iVBORw0KGgoAAAANSUhEUgAAAA8AAAACCAIAAAAIKhHDAAAAFUlEQVR4nGP8//8/A9GAiXilDAwMAA4VAwEw52YlAAAAAElFTkSuQmCC'
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
		// The OCR was unsure of the protein figure.
		{ ...line(a, 300, 120 + i * 26, 60), score: a === '6,5' ? 0.7 : 0.95 },
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
	await page.goto('/log');
	await page.getByRole('button', { name: 'Scan a label' }).click();
	await page.waitForLoadState('networkidle'); // the file input has no handler until the page is ready
	await page.getByLabel('Choose photo').setInputFiles({
		name: 'label.png',
		mimeType: 'image/png',
		buffer: WIDE3
	});
	await expect(page.getByText('Check every value against your photo')).toBeVisible();
	await expect(page.getByRole('heading', { level: 1, name: 'Check the label' })).toBeVisible();
	// What was read and decided, in place of the hint on copying a label.
	const notes = page.getByRole('list', { name: 'What was read' });
	await expect(notes.getByRole('listitem')).toHaveText([
		'Protein was hard to read in the photo. Check it against the label: a missed decimal comma turns 2,5 into 25.',
		'Read per 100 g. The per-serving and %RI columns were skipped.',
		"400 kcal matches the label's 1673 kJ.",
		"Fibre wasn't read, so it stays unknown, not zero. Type it if it's on the label."
	]);
	await expect(page.getByText('Copy the label.')).toBeHidden();
	// The photo went out small and as JPEG (drawn again on the phone, which drops its location data).
	const sent = await (await request.get(`${SPEECH_STUB}/last-ocr`)).json();
	expect(sent).toMatchObject({ jpeg: true, width: 3 });
	// The photo is one tap away.
	await expect(page.getByRole('img', { name: 'Your photo of the label' })).toBeHidden();
	await page.getByRole('button', { name: 'Your photo' }).click();
	await expect(page.getByRole('img', { name: 'Your photo of the label' })).toBeVisible();

	// Values per 100 g from the table and the bound kept; the serving is not made a portion; the name is typed.
	await expect(page.locator('#n-energy_kcal')).toHaveValue('400');
	await expect(page.locator('#n-fat')).toHaveValue('18');
	await expect(page.locator('#n-carbohydrate')).toHaveValue('52');
	await expect(page.locator('#n-salt')).toHaveValue('0,1');
	await expect(page.getByRole('button', { name: 'Salt: less than' })).toHaveAttribute(
		'aria-pressed',
		'true'
	);
	await page.getByLabel('Name', { exact: true }).fill(`Fındıklı gofret ${testInfo.project.name}`);
	await page.getByRole('button', { name: 'Save and choose amount' }).click();

	// Saved, then straight to the amount sheet in Log; nothing is logged until Save there.
	const sheet = page.getByRole('dialog', {
		name: new RegExp(`Fındıklı gofret ${testInfo.project.name}`)
	});
	await expect(sheet).toBeVisible();
	await expect(sheet.getByRole('button', { name: /porsiyon/ })).toHaveCount(0);
	await sheet.getByRole('button', { name: /^Log to/ }).click();
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

test('a label that cannot be read says so and offers to fill it in by hand', async ({
	page,
	request
}, testInfo) => {
	await signedInAs(page, `Boş ${testInfo.project.name}`);
	await request.post(`${SPEECH_STUB}/next-ocr`, {
		data: { width: 5, status: 200, body: { lines: [line('Net Miktar: 400 g', 20, 40)], ocrMs: 1 } }
	});
	await page.goto('/log');
	await page.getByRole('button', { name: 'Scan a label' }).click();
	await page.waitForLoadState('networkidle'); // the file input has no handler until the page is ready
	await page
		.getByLabel('Choose photo')
		.setInputFiles({ name: 'x.png', mimeType: 'image/png', buffer: WIDE5 });
	await expect(page.getByRole('alert')).toContainText('No nutrition table found');
	await expect(page.getByRole('dialog', { name: 'Scan a label' })).toBeVisible();
	// A scanner that stays busy: it waits in line, then gives up after two minutes.
	await request.post(`${SPEECH_STUB}/next-ocr`, {
		data: { width: 9, status: 503, body: { error: 'busy', ahead: 3 } }
	});
	await page.clock.install();
	await page
		.getByLabel('Choose photo')
		.setInputFiles({ name: 'x.png', mimeType: 'image/png', buffer: WIDE9 });
	const waiting = page.getByRole('status').filter({ hasText: 'Waiting for the scanner' });
	await expect(waiting).toContainText("It's reading 3 other labels.");
	await page.clock.fastForward(125_000);
	await page.clock.runFor(4000);
	await expect(page.getByRole('alert')).toContainText('The server is reading other labels');
	await page.getByRole('button', { name: 'Fill in by hand' }).click();
	await expect(page.locator('#n-energy_kcal')).toHaveValue('');
	await expect(page.getByRole('heading', { level: 1, name: 'New food' })).toBeVisible();
	await expect(page.getByRole('button', { name: 'Retake' })).toBeVisible();
});

test('Scan opens as a sheet over Log; a corrected value is counted and admins see household totals', async ({
	page,
	request
}, testInfo) => {
	await signedInAs(page, `Toplu ${testInfo.project.name}`, 'admin');
	await request.post(`${SPEECH_STUB}/next-ocr`, {
		data: { width: 7, status: 200, body: { lines: TABLE, ocrMs: 1 } }
	});
	await page.goto('/log');
	await page.getByRole('button', { name: 'Scan a label' }).click();
	// A sheet like Speak and Type it (owner, 2026-11-09, as in the approved demo); closing it stays on Log.
	const sheet = page.getByRole('dialog', { name: 'Scan a label' });
	await expect(sheet).toContainText('Fill the frame with the nutrition table');
	await expect(page).toHaveURL(/\/log/);
	await sheet.getByRole('button', { name: 'Close' }).click();
	await expect(sheet).toBeHidden();
	await page.getByRole('button', { name: 'Scan a label' }).click();
	await page.waitForLoadState('networkidle');
	await sheet
		.getByLabel('Choose photo')
		.setInputFiles({ name: 'x.png', mimeType: 'image/png', buffer: WIDE7 });
	await expect(page.getByRole('heading', { level: 1, name: 'Check the label' })).toBeVisible();
	// No "Log it after saving" choice: from Log, saving always goes on to the amount.
	await expect(page.getByLabel('Log it after saving')).toHaveCount(0);
	// One value corrected before saving is counted as one change; admins see household totals.
	await page.locator('#n-energy_kcal').fill('410');
	await page.getByLabel('Name', { exact: true }).fill(`Gofret 2 ${testInfo.project.name}`);
	await page.getByRole('button', { name: 'Save and choose amount' }).click();
	await expect(page.getByRole('dialog', { name: new RegExp(`Gofret 2`) })).toBeVisible();
	expect(await scanEditsFor(`Gofret 2 ${testInfo.project.name}`)).toMatchObject({
		changed: 1,
		removed: 0,
		added: 0
	});
	// Check the label opened without a reading (a reload) goes back to Log with the sheet open.
	await page.goto('/scan');
	await expect(page.getByRole('dialog', { name: 'Scan a label' })).toBeVisible();
	await page.goto('/household');
	await expect(page.getByTestId('scan-totals')).toContainText('Labels saved');
});

test('a busy scanner keeps the photo waiting in line and reads it when there is room', async ({
	page,
	request
}, testInfo) => {
	await signedInAs(page, `Sıra ${testInfo.project.name}`);
	await request.post(`${SPEECH_STUB}/next-ocr`, {
		data: {
			width: 11,
			status: 503,
			body: { error: 'busy', ahead: 1 },
			then: { status: 200, body: { lines: TABLE, ocrMs: 900, queueMs: 0 } }
		}
	});
	await page.goto('/scan');
	await page.waitForLoadState('networkidle');
	await page
		.getByLabel('Choose photo')
		.setInputFiles({ name: 'x.png', mimeType: 'image/png', buffer: WIDE11 });
	await expect(
		page.getByRole('status').filter({ hasText: 'Waiting for the scanner' })
	).toContainText("It's reading another label. Yours is next");
	await expect(page.getByRole('button', { name: 'Fill in by hand' })).toBeVisible();
	// Asked again by itself: the proposal arrives without another tap.
	await expect(page.getByRole('heading', { level: 1, name: 'Check the label' })).toBeVisible({
		timeout: 10_000
	});
	await expect(page.locator('#n-energy_kcal')).toHaveValue('400');
});

test('a blurry photo says so: instead of "no table" when nothing was read, as a note when something was', async ({
	page,
	request
}, testInfo) => {
	await signedInAs(page, `Bulanık ${testInfo.project.name}`);
	await request.post(`${SPEECH_STUB}/next-ocr`, {
		data: { width: 13, status: 200, body: { lines: [], sharpness: 0.11, ocrMs: 1 } }
	});
	await request.post(`${SPEECH_STUB}/next-ocr`, {
		data: { width: 15, status: 200, body: { lines: TABLE, sharpness: 0.12, ocrMs: 1 } }
	});
	await page.goto('/scan');
	await page.waitForLoadState('networkidle');
	await page
		.getByLabel('Choose photo')
		.setInputFiles({ name: 'x.png', mimeType: 'image/png', buffer: WIDE13 });
	await expect(page.getByRole('alert')).toContainText('The photo is blurry');
	await expect(page.getByRole('alert')).not.toContainText('No nutrition table found');

	await page
		.getByLabel('Choose photo')
		.setInputFiles({ name: 'x.png', mimeType: 'image/png', buffer: WIDE15 });
	const notes = page.getByRole('list', { name: 'What was read' });
	await expect(notes.getByRole('listitem').first()).toHaveText(
		'The photo looks blurry, so some values may be misread. Check each one against the label.'
	);
});
