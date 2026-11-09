// People's own OpenAI or OpenRouter key for Speak and Scan (docs/ui.md, "Your own AI key for Speak and Scan"),
// against the stand-in provider in tests/e2e/speech-stub.ts: a key starting "sk-good" is accepted.
import { expect, test, type Page } from '@playwright/test';
import { NO_ADDONS, SPEECH_STUB } from '../../playwright.config.ts';
import { signedInAs } from './fixtures.ts';

const keyFor = (name: string) => `sk-good-${name.replace(/\W/g, '')}-0123456789ABCD`;
const nextAnswer = (key: string, status: number, body: unknown) =>
	fetch(`${SPEECH_STUB}/next-provider`, {
		method: 'POST',
		body: JSON.stringify({ key, status, body })
	});
const lastRequest = async (key: string) =>
	(await fetch(`${SPEECH_STUB}/last-provider?key=${encodeURIComponent(key)}`)).json();

/** A saved key chosen for a feature, through the app's own API (the screens are tested separately). */
async function useKey(
	page: Page,
	provider: 'openai' | 'openrouter',
	key: string,
	feature: 'speak' | 'scan'
) {
	await page.goto('/more');
	await page.evaluate(
		async ([provider, key, feature]) => {
			const send = (method: string, path: string, body: unknown) =>
				fetch(path, {
					method,
					headers: { 'content-type': 'application/json' },
					body: JSON.stringify(body)
				}).then((r) => {
					if (!r.ok) throw new Error(`${path} ${r.status}`);
				});
			await send('POST', '/api/v1/remote-models/keys', { provider, key });
			await send('PUT', '/api/v1/remote-models/choice', {
				feature,
				source: provider,
				allowed: true
			});
		},
		[provider, key, feature]
	);
}

const PNG = Buffer.from(
	'iVBORw0KGgoAAAANSUhEUgAAAAMAAAACCAIAAAASFvFNAAAADklEQVR4nGP4DwMMcBYAs2AR7za3GVIAAAAASUVORK5CYII=',
	'base64'
);

test('adding a key: a refused one is never saved; allowing a company is explicit; removing goes back to the server', async ({
	page
}, testInfo) => {
	const name = `Anahtar ${testInfo.project.name}`;
	await signedInAs(page, name);
	await page.goto('/more/settings');
	await page.getByRole('link', { name: /Speak and Scan/ }).click();
	await expect(page.getByRole('heading', { level: 1, name: 'Speak and Scan' })).toBeVisible();
	const speakCard = page.getByRole('radiogroup', { name: 'Speak' });
	await expect(speakCard.getByRole('radio', { name: /On this server/ })).toBeChecked();
	await expect(speakCard.getByRole('radio', { name: /With my own key/ })).toBeDisabled();

	await page.getByRole('button', { name: 'Add a key' }).click();
	const sheet = page.getByRole('dialog', { name: 'Add a key' });
	await sheet.getByLabel('API key').fill('sk-wrong-0000000000000000000000');
	await sheet.getByRole('button', { name: 'Check and save' }).click();
	await expect(sheet).toContainText('OpenAI refused this key.');
	await sheet.getByLabel('API key').fill(keyFor(name));
	await sheet.getByRole('button', { name: 'Check and save' }).click();
	await expect(sheet).toBeHidden();
	await expect(page.getByText('···· ABCD')).toBeVisible();

	// Choosing the key asks first; keeping it on the server changes nothing.
	const openai = speakCard.getByRole('radio', { name: /With my OpenAI key/ });
	await openai.click();
	const ask = page.getByRole('dialog', { name: 'Send your recordings to OpenAI?' });
	await expect(ask).toContainText('each recording');
	await expect(ask).toContainText('the names of foods and brands you log often');
	await ask.getByRole('button', { name: 'Keep it on this server' }).click();
	await expect(speakCard.getByRole('radio', { name: /On this server/ })).toBeChecked();
	await openai.click();
	await ask.getByRole('button', { name: 'Send to OpenAI' }).click();
	await expect(openai).toBeChecked();
	// Scan is separate and still on the server.
	await expect(
		page.getByRole('radiogroup', { name: 'Scan' }).getByRole('radio', { name: /On this server/ })
	).toBeChecked();

	await page.getByRole('button', { name: 'Remove your OpenAI key' }).click();
	await expect(page.getByText('···· ABCD')).toBeHidden();
	await expect(speakCard.getByRole('radio', { name: /On this server/ })).toBeChecked();
});

test('Scan with a key: the copied table fills the form, read by the company and flagged to check', async ({
	page
}, testInfo) => {
	const name = `Etiket ${testInfo.project.name}`;
	const key = keyFor(name);
	await signedInAs(page, name);
	await useKey(page, 'openai', key, 'scan');
	const table = {
		title: 'Nutrition information',
		columns: ['per 100 g', 'per serving (30 g)'],
		rows: [
			{ name: 'Energy', values: ['1673 kJ / 400 kcal', '502 kJ / 120 kcal'] },
			{ name: 'Fat', values: ['18 g', '5,4 g'] },
			{ name: 'Carbohydrate', values: ['52 g', '15,6 g'] },
			{ name: 'Protein', values: ['6,5 g', '2 g'] },
			{ name: 'Salt', values: ['<0,1 g', '<0,1 g'] }
		]
	};
	await nextAnswer(key, 200, { choices: [{ message: { content: JSON.stringify(table) } }] });
	await page.goto('/scan');
	await expect(page.getByText('With your OpenAI key')).toBeVisible();
	await page.waitForLoadState('networkidle');
	await page
		.getByLabel('Choose photo')
		.setInputFiles({ name: 'label.png', mimeType: 'image/png', buffer: PNG });
	const notes = page.getByRole('list', { name: 'What was read' });
	await expect(notes.getByRole('listitem').first()).toHaveText(
		'Read by OpenAI. Check each value against your photo.'
	);
	await expect(page.locator('#n-energy_kcal')).toHaveValue('400');
	await expect(page.locator('#n-protein')).toHaveValue('6,5');
	expect(await lastRequest(key)).toMatchObject({
		path: '/chat/completions',
		model: 'gpt-5-mini',
		routing: null
	});

	// A refused key: one card, one fixing button, typing as the way on, and the server for this one photo.
	await nextAnswer(key, 401, { error: { code: 'invalid_api_key' } });
	await page.goto('/scan');
	await page.waitForLoadState('networkidle');
	await page
		.getByLabel('Choose photo')
		.setInputFiles({ name: 'label.png', mimeType: 'image/png', buffer: PNG });
	const card = page.getByRole('alert').filter({ hasText: 'OpenAI refused your key' });
	await expect(card).toBeVisible();
	await expect(card.getByRole('button', { name: 'Fill in by hand' })).toBeVisible();
	await expect(
		card.getByRole('button', { name: 'Read this one on obur’s server instead' })
	).toBeVisible();
	await card.getByRole('button', { name: 'Replace the key' }).click();
	await expect(page.getByRole('heading', { level: 1, name: 'Speak and Scan' })).toBeVisible();
});

test.describe('Speak with a key', () => {
	// Chromium's fake microphone; WebKit in Playwright has none.
	test.skip(({ browserName }) => browserName !== 'chromium', 'needs a fake microphone');
	test.beforeEach(async ({ context }) => {
		await context.grantPermissions(['microphone']);
	});

	test('sends to OpenRouter only through endpoints that keep nothing, and explains running out of credit', async ({
		page
	}) => {
		const key = keyFor('Konuşma');
		await signedInAs(page, 'Konuşma');
		await useKey(page, 'openrouter', key, 'speak');
		await nextAnswer(key, 200, { text: 'two glasses of water' });
		await page.goto('/log');
		await page.getByRole('button', { name: 'Speak' }).click();
		const speak = page.getByRole('dialog', { name: 'Speak' });
		await expect(speak).toContainText('With your OpenRouter key');
		await page.waitForTimeout(1200);
		await speak.getByRole('button', { name: 'Done' }).click();
		await expect(
			page.getByRole('dialog', { name: 'Check and log' }).getByLabel('I heard')
		).toHaveValue('two glasses of water');
		expect(await lastRequest(key)).toMatchObject({
			path: '/audio/transcriptions',
			model: 'openai/whisper-large-v3',
			routing: { zdr: true, data_collection: 'deny' }
		});

		await nextAnswer(key, 402, { error: { message: 'Insufficient credits' } });
		await page.goto('/log');
		await page.getByRole('button', { name: 'Speak' }).click();
		await page.waitForTimeout(1000);
		await speak.getByRole('button', { name: 'Done' }).click();
		await expect(speak).toContainText('Your OpenRouter account is out of credit');
		await expect(speak.getByRole('button', { name: 'Record again' })).toBeVisible();
		await expect(speak.getByRole('button', { name: 'Type it instead' })).toBeVisible();
	});
});

test('a server without the add-ons keeps Speak and Scan and offers the person’s own key', async ({
	page
}, testInfo) => {
	await signedInAs(page, `Eklentisiz ${testInfo.project.name}`);
	await page.goto(`${NO_ADDONS}/log`);
	await expect(page.getByRole('button', { name: 'Scan a label' })).toBeVisible();
	await page.getByRole('button', { name: 'Speak' }).click();
	const sheet = page.getByRole('dialog', { name: 'Speak isn’t set up on this server' });
	await expect(sheet).toContainText('your own OpenAI or OpenRouter key');
	await sheet.getByRole('button', { name: 'Use my own key' }).click();
	await expect(page.getByRole('heading', { level: 1, name: 'Speak and Scan' })).toBeVisible();
	// Nothing on this server reads recordings, so that choice can't be made.
	await expect(
		page.getByRole('radiogroup', { name: 'Speak' }).getByRole('radio', { name: /On this server/ })
	).toBeDisabled();
	await expect(page.getByRole('radiogroup', { name: 'Speak' })).toContainText(
		'Not set up on this server. Your household’s admin can add it.'
	);

	await page.goto(`${NO_ADDONS}/scan`);
	await expect(page.getByText('Scan isn’t set up on this server')).toBeVisible();
	await expect(page.getByRole('button', { name: 'Use my own key' })).toBeVisible();
});

test('an admin is told which add-on a server without them needs', async ({ page }, testInfo) => {
	test.skip(
		testInfo.project.name !== 'desktop-chromium',
		'one browser is enough for a line of text'
	);
	await signedInAs(page, 'Yönetici Eklentisiz', 'admin');
	await page.goto(`${NO_ADDONS}/more/speak-and-scan`);
	await expect(page.getByRole('radiogroup', { name: 'Speak' })).toContainText(
		'Needs the obur-speech add-on'
	);
	await expect(page.getByRole('radiogroup', { name: 'Scan' })).toContainText(
		'Needs the obur-labels add-on'
	);
});

test('the household’s admin sees the personal keys switch, on by default', async ({
	page
}, testInfo) => {
	test.skip(testInfo.project.name !== 'desktop-chromium', 'one browser is enough for a switch');
	await signedInAs(page, 'Yönetici Anahtar', 'admin');
	await page.goto('/household');
	await expect(page.getByRole('switch', { name: 'Personal AI keys' })).toBeChecked();
});
