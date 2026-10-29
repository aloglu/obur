// Your data: export, import with a preview, and account deletion (docs/design.md, "Your data").
import { readdirSync, readFileSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { expect, test } from '@playwright/test';
import { strFromU8, strToU8, unzipSync, zipSync } from 'fflate';
import { apiAs, signedInAs } from './fixtures.ts';

const DAY = '2026-10-20';

test('an export imports into another account after a preview, once', async ({ page }) => {
	await signedInAs(page, 'Elif');
	for (const description of ['Mercimek çorbası', 'Mercimek çorbası']) {
		await apiAs(page, 'POST', '/api/v1/diary/entries', {
			kind: 'quick',
			date: DAY,
			meal: 'lunch',
			zone: 'Europe/Istanbul',
			kcal: 180,
			description
		});
	}

	await page.goto('/settings/data');
	const download = page.waitForEvent('download');
	await page.getByRole('button', { name: 'Download export' }).click();
	const file = await (await download).path();
	const archive = await readFile(file);
	const files = unzipSync(archive);
	expect(JSON.parse(strFromU8(files['manifest.json'])).format).toBe('obur-export');
	expect(JSON.parse(strFromU8(files['data/diary.json']))).toHaveLength(2);

	// Someone else imports it: the preview comes first and writes nothing.
	// Leave Elif's page before switching accounts, so nothing of hers is still loading.
	await page.goto('about:blank');
	await page.context().clearCookies();
	await signedInAs(page, 'Selin');
	await page.goto('/settings/data');
	const chooser = page.locator('input[type=file]');
	await expect(chooser).toBeEnabled();
	await chooser.setInputFiles({ name: 'export.zip', mimeType: 'application/zip', buffer: archive });
	const preview = page.getByTestId('import-preview');
	await expect(preview.getByRole('row', { name: /Diary entries/ })).toContainText('2');
	const empty = await apiAs<{ entries: unknown[] }>(page, 'GET', `/api/v1/diary/${DAY}`);
	expect(empty.entries).toHaveLength(0);

	await preview.getByRole('button', { name: 'Import' }).click();
	await expect(page.getByRole('status')).toContainText('Import finished');
	const day = await apiAs<{ entries: { description: string }[] }>(
		page,
		'GET',
		`/api/v1/diary/${DAY}`
	);
	// Two identical meals stay two entries.
	expect(day.entries.map((e) => e.description)).toEqual(['Mercimek çorbası', 'Mercimek çorbası']);

	// The same file again is recognised and cannot be applied.
	await chooser.setInputFiles({ name: 'export.zip', mimeType: 'application/zip', buffer: archive });
	await expect(preview).toContainText('already been imported');
	await expect(preview.getByRole('button', { name: 'Import' })).toBeDisabled();
});

test('a file that is not an intact export is refused', async ({ page }) => {
	await signedInAs(page, 'Deniz');
	await page.goto('/settings/data');
	await expect(page.locator('input[type=file]')).toBeEnabled();
	await page.locator('input[type=file]').setInputFiles({
		name: 'export.zip',
		mimeType: 'application/zip',
		buffer: Buffer.from('not a zip')
	});
	await expect(page.getByRole('alert')).toContainText("isn't a complete, unchanged obur export");
	await expect(page.getByTestId('import-preview')).toHaveCount(0);
});

test('a person deletes their own account after confirming', async ({ page }) => {
	await signedInAs(page, 'Kerem');
	await page.goto('/settings/data');
	await page.getByRole('button', { name: 'Delete my account' }).click();
	const sheet = page.getByRole('dialog', { name: 'Delete your account?' });
	const confirm = sheet.getByRole('button', { name: 'Delete account' });
	await expect(confirm).toBeDisabled();
	await sheet.getByLabel("I understand this can't be undone").check();
	await confirm.click();
	await expect(page).toHaveURL(/\/login$/);
	// The old session is gone with the account.
	const response = await page.request.get('/api/v1/profile');
	expect(response.status()).toBe(401);
});

test('an admin deletes a member, and the deletion is listed by ID only', async ({
	page,
	browser
}) => {
	const member = await browser.newContext();
	const memberPage = await member.newPage();
	const name = `Burak ${memberPage.viewportSize()?.width ?? ''}-${Date.now()}`;
	const memberId = await signedInAs(memberPage, name);
	await member.close();

	await signedInAs(page, 'Gül', 'admin');
	await page.goto('/household');
	// Development and test installations have no backup service, and the page says so.
	await expect(page.getByText("Backups aren't set up on this installation.")).toBeVisible();
	const people = page.locator('section', { has: page.getByRole('heading', { name: 'People' }) });
	await people
		.getByRole('listitem')
		.filter({ hasText: name })
		.getByRole('button', { name: 'Delete account' })
		.click();
	await page
		.getByRole('dialog', { name: `Delete ${name}'s account?` })
		.getByRole('button', { name: 'Delete account' })
		.click();
	await expect(people).not.toContainText(name);
	await expect(page.getByTestId('deletions')).toContainText(memberId);
	await expect(page.getByTestId('deletions')).not.toContainText(name);
});

test('a LoseIt export imports after a preview that checks it against LoseIt’s own totals', async ({
	page
}) => {
	const dir = path.resolve(import.meta.dirname, '../fixtures/loseit');
	const loseit = zipSync(
		Object.fromEntries(
			readdirSync(dir)
				.filter((f) => f.endsWith('.csv'))
				.map((f) => [f, strToU8(readFileSync(path.join(dir, f), 'utf8'))])
		)
	);
	await signedInAs(page, 'Okan');
	await page.goto('/settings/data');
	const chooser = page.locator('input[type=file]');
	await expect(chooser).toBeEnabled();
	await chooser.setInputFiles({
		name: 'loseit.zip',
		mimeType: 'application/zip',
		buffer: Buffer.from(loseit)
	});
	const preview = page.getByTestId('import-preview');
	await expect(preview).toContainText('LoseIt export');
	await expect(preview).toContainText('All 4 days add up');
	await expect(preview.getByRole('row', { name: /Diary entries/ })).toContainText('18');
	await expect(preview).toContainText('Entries you deleted in LoseIt are left out (1)');
	await preview.getByRole('radio', { name: 'kg' }).click();
	await preview.getByRole('button', { name: 'Import' }).click();
	await expect(page.getByRole('status')).toContainText('Import finished');
	const day = await apiAs<{ entries: { food: { name: string } | null }[] }>(
		page,
		'GET',
		'/api/v1/diary/2026-01-07'
	);
	expect(day.entries.map((e) => e.food?.name)).toContain('Greek yogurt, plain');
	// Imported carbs state no definition: shown with a note, not left out.
	await page.goto('/?date=2026-01-07');
	const nutrients = page.getByRole('region', { name: 'Nutrients' });
	await expect(nutrients).toContainText('84,4 g');
	await expect(nutrients).toContainText('Definition not stated (imported)');
});
