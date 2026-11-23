import { expect, test } from '@playwright/test';
import { SPEECH_STUB } from '../../playwright.config.ts';
import { createFood, signedInAs } from './fixtures.ts';

// Chromium's and Firefox's fake microphones (set up in playwright.config.ts); WebKit in Playwright has none, so these
// run in desktop Chromium and Firefox. The iPhone was checked by hand (2026-11-23, spikes/speech-browser).
test.skip(({ browserName }) => browserName === 'webkit', 'needs a fake microphone');
// The Docker test container has no sound device, and Firefox starts no audio without one (Chromium does).
test.skip(
	({ browserName }) => browserName === 'firefox' && !!process.env.OBUR_E2E_DOCKER,
	'Firefox needs a sound device; run these on the computer: npx playwright test --project=desktop-firefox'
);
test.beforeEach(async ({ context, browserName }) => {
	// Firefox's microphone question is turned off by its settings instead.
	if (browserName === 'chromium') await context.grantPermissions(['microphone']);
});

const nextTranscript = (body: unknown, status = 200) =>
	fetch(`${SPEECH_STUB}/next`, { method: 'POST', body: JSON.stringify({ status, body }) });

test('Speak records, sends the clip with the person’s foods as a prompt, and confirms what it heard', async ({
	page
}) => {
	await signedInAs(page, 'Ses');
	await createFood(page, {
		name: 'Sesli Ayran',
		brand: 'Köy',
		basis: '100ml',
		nutrients: [{ code: 'energy_kcal', value: 40, qualifier: 'reported' }],
		servings: [{ name: 'kutu', amount: 200, unit: 'ml' }]
	});
	// Log it once so it is a recent food and part of the prompt.
	await page.goto('/log');
	await page.getByRole('searchbox').fill('sesli ayran');
	await page
		.getByRole('button', { name: /Köy Sesli Ayran/ })
		.first()
		.click();
	await page
		.getByRole('dialog')
		.getByRole('button', { name: /^Log to/ })
		.click();
	await expect(page.getByRole('status')).toContainText('Logged');

	await nextTranscript({
		text: 'Akşam bir kutu sesli ayran ve iki bardak su içtim.',
		language: 'tr',
		audioS: 2,
		queueMs: 0,
		asrMs: 900
	});
	await page.goto('/log');
	await page.getByRole('button', { name: 'Speak' }).click();
	const speak = page.getByRole('dialog', { name: 'Speak' });
	await expect(speak).toContainText('Listening… say what you ate');
	await page.waitForTimeout(1200);
	await speak.getByRole('button', { name: 'Done' }).click();

	const sheet = page.getByRole('dialog', { name: 'Check and log' });
	await expect(sheet.getByLabel('I heard')).toHaveValue(
		'Akşam bir kutu sesli ayran ve iki bardak su içtim.'
	);
	await expect(sheet.getByRole('region', { name: 'Köy Sesli Ayran' })).toContainText('80');
	await expect(sheet.getByRole('radio', { name: 'Dinner' })).toBeChecked();
	const sent = await (await fetch(`${SPEECH_STUB}/last`)).json();
	expect(sent.prompt).toContain('Köy');
	expect(sent.prompt).toContain('Sesli Ayran');
	expect(sent.audioBytes).toBeGreaterThan(1000);
	// The phone makes the 16 kHz mono WAV the add-on reads (A11); Chromium's fake microphone beeps, so it is not silent.
	expect(sent.wav).toMatchObject({ rate: 16000, channels: 1, bits: 16 });
	expect(sent.wav.seconds).toBeGreaterThan(0.8);
	expect(sent.wav.seconds).toBeLessThan(5);
	expect(sent.wav.peak).toBeGreaterThan(0.01);
	await sheet.getByRole('button', { name: 'Log 2 to Dinner' }).click();
	await expect(page.getByRole('status')).toContainText('Logged 2 items');
});

test('Speak says when nothing was heard or the service is busy, and offers to try again', async ({
	page
}) => {
	await signedInAs(page, 'Sessiz');
	await page.goto('/log');
	await nextTranscript({ text: '  ', language: 'tr', audioS: 1, queueMs: 0, asrMs: 300 });
	await page.getByRole('button', { name: 'Speak' }).click();
	const speak = page.getByRole('dialog', { name: 'Speak' });
	// Done at once: an empty recording is "nothing heard" too.
	await speak.getByRole('button', { name: 'Done' }).click();
	await expect(speak.getByRole('status')).toContainText("I didn't hear anything");
	await speak.getByRole('button', { name: 'Try again' }).click();
	await page.waitForTimeout(1000);
	await speak.getByRole('button', { name: 'Done' }).click();
	await expect(speak.getByRole('status')).toContainText("I didn't hear anything");
	await nextTranscript({ error: 'busy' }, 503);
	await speak.getByRole('button', { name: 'Try again' }).click();
	await page.waitForTimeout(1000);
	await speak.getByRole('button', { name: 'Done' }).click();
	await expect(speak.getByRole('alert')).toContainText('The speech service is busy');
	await speak.getByRole('button', { name: 'Type it instead' }).click();
	await expect(speak).toBeHidden();
	await expect(page.getByRole('dialog', { name: 'Type what you ate' })).toBeVisible();
});

test('Try again after a busy service sends the same recording, without recording again (A30)', async ({
	page
}) => {
	await signedInAs(page, 'Tekrar');
	await page.goto('/log');
	await nextTranscript({ error: 'busy' }, 503);
	await page.getByRole('button', { name: 'Speak' }).click();
	const speak = page.getByRole('dialog', { name: 'Speak' });
	await page.waitForTimeout(1000);
	await speak.getByRole('button', { name: 'Done' }).click();
	await expect(speak.getByRole('alert')).toContainText('The speech service is busy');
	const first = await (await fetch(`${SPEECH_STUB}/last`)).json();
	await nextTranscript({
		text: 'iki bardak su',
		language: 'tr',
		audioS: 1,
		queueMs: 0,
		asrMs: 300
	});
	await speak.getByRole('button', { name: 'Try again' }).click();
	// Straight to what it heard: no new recording, so no Done to tap.
	await expect(page.getByRole('dialog', { name: 'Check and log' })).toBeVisible();
	const again = await (await fetch(`${SPEECH_STUB}/last`)).json();
	expect(again.audioBytes).toBe(first.audioBytes);
});

test('closing Speak while the microphone question is open never starts recording (A29)', async ({
	page
}) => {
	// The permission answer comes only when the test gives it, after the sheet is closed.
	await page.addInitScript(() => {
		const w = window as unknown as { __grant?: () => Promise<void>; __streams: MediaStream[] };
		w.__streams = [];
		const original = navigator.mediaDevices.getUserMedia.bind(navigator.mediaDevices);
		navigator.mediaDevices.getUserMedia = (constraints) =>
			new Promise((resolve) => {
				w.__grant = async () => {
					const stream = await original(constraints);
					w.__streams.push(stream);
					resolve(stream);
				};
			});
	});
	await signedInAs(page, 'Mikrofon');
	await page.goto('/log');
	await page.getByRole('button', { name: 'Speak' }).click();
	const speak = page.getByRole('dialog', { name: 'Speak' });
	await expect(speak).toBeVisible();
	await page.keyboard.press('Escape');
	await expect(speak).toBeHidden();
	await page.evaluate(() => (window as unknown as { __grant: () => Promise<void> }).__grant());
	await page.waitForTimeout(500);
	const live = await page.evaluate(
		() =>
			(window as unknown as { __streams: MediaStream[] }).__streams
				.flatMap((s) => s.getTracks())
				.filter((t) => t.readyState === 'live').length
	);
	expect(live).toBe(0);
});

test('a browser that cannot record raw sound says so and offers typing (A11)', async ({ page }) => {
	await page.addInitScript(() => {
		delete (window as unknown as { AudioWorkletNode?: unknown }).AudioWorkletNode;
	});
	await signedInAs(page, 'Eski Tarayıcı');
	await page.goto('/log');
	await page.getByRole('button', { name: 'Speak' }).click();
	const speak = page.getByRole('dialog', { name: 'Speak' });
	await expect(speak.getByRole('alert')).toContainText("This browser can't record for Speak");
	await speak.getByRole('button', { name: 'Type it instead' }).click();
	await expect(page.getByRole('dialog', { name: 'Type what you ate' })).toBeVisible();
});

test('a browser whose sound never starts says so instead of waiting (2026-11-23)', async ({
	page
}) => {
	await page.addInitScript(() => {
		AudioContext.prototype.resume = () => new Promise<void>(() => {});
		Object.defineProperty(AudioContext.prototype, 'state', { get: () => 'suspended' });
	});
	await signedInAs(page, 'Sessiz Cihaz');
	await page.goto('/log');
	await page.getByRole('button', { name: 'Speak' }).click();
	const speak = page.getByRole('dialog', { name: 'Speak' });
	await expect(speak.getByRole('alert')).toContainText("Speak can't start recording", {
		timeout: 10_000
	});
	await expect(speak.getByRole('button', { name: 'Try again' })).toBeVisible();
});

test('Speak opens at its full size: the example, the time and Done are there while the microphone starts', async ({
	page
}, testInfo) => {
	await signedInAs(page, `Tek parça ${testInfo.project.name}`);
	// The microphone answers only when the test says so.
	await page.addInitScript(() => {
		const real = navigator.mediaDevices.getUserMedia.bind(navigator.mediaDevices);
		const w = window as unknown as { micGo: () => void };
		const go = new Promise<void>((r) => (w.micGo = r));
		navigator.mediaDevices.getUserMedia = async (c) => {
			await go;
			return real(c);
		};
	});
	await page.goto('/log');
	await page.getByRole('button', { name: 'Speak' }).click();
	const speak = page.getByRole('dialog', { name: 'Speak' });
	await expect(speak).toContainText('Starting the microphone…');
	await expect(speak.getByText('two eggs and toast for breakfast')).toBeVisible();
	await expect(speak.getByText('0 s of 30')).toBeVisible();
	await expect(speak.getByRole('button', { name: 'Done' })).toBeDisabled();
	await page.waitForTimeout(500); // slid in
	const before = (await speak.boundingBox())!.height;
	await page.evaluate(() => (window as unknown as { micGo: () => void }).micGo());
	await expect(speak).toContainText('Listening… say what you ate');
	await expect(speak.getByRole('button', { name: 'Done' })).toBeEnabled();
	expect((await speak.boundingBox())!.height).toBe(before);
});
