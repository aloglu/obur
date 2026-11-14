// Your data: export, import with a preview, and account deletion (docs/design.md, "Your data").
import { readdirSync, readFileSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { expect, test } from '@playwright/test';
import { strFromU8, strToU8, unzipSync, zipSync } from 'fflate';
import { apiAs, createFood, signedInAs, staleSessions } from './fixtures.ts';

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

	await preview.getByRole('button', { name: /^Import/ }).click();
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
	await expect(preview.getByRole('button', { name: /^Import/ })).toHaveCount(0);
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
	// Nothing shared: no question about shared foods (owner, 2026-11-10).
	await expect(page.getByText('Delete account', { exact: true })).toBeVisible();
	await expect(page.getByRole('radiogroup', { name: /shared/ })).toHaveCount(0);
	await createFood(page, {
		name: 'Kerem’s soup',
		basis: '100g',
		nutrients: [{ code: 'energy_kcal', value: 56, qualifier: 'reported' }]
	});
	await page.reload();
	await expect(
		page.getByRole('radiogroup', {
			name: "You shared 1 food with other members. Keep it in everyone's search?"
		})
	).toBeVisible();
	await page.getByRole('button', { name: 'Delete my account' }).click();
	const sheet = page.getByRole('dialog', { name: 'Delete your account?' });
	await expect(sheet).toContainText('Foods you shared stay for other members.');
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
	for (const food of ['Lentil soup', 'Flatbread'])
		await createFood(memberPage, {
			name: `${food} ${name}`,
			basis: '100g',
			nutrients: [{ code: 'energy_kcal', value: 100, qualifier: 'reported' }]
		});
	await member.close();

	const adminId = await signedInAs(page, 'Gül', 'admin');
	// Without a recent passkey check the server refuses, whatever the page does.
	await staleSessions(adminId);
	await page.goto('/members');
	const refused = await page.request.delete('/api/v1/admin/members', {
		headers: { origin: new URL(page.url()).origin },
		data: { id: memberId, removeSharedFoods: false }
	});
	expect(refused.status()).toBe(403);
	expect((await refused.json()).error).toBe('recent_auth_required');
	await signedInAs(page, 'Gül again', 'admin');
	// Development and test installations have no backup service, and the page says so.
	await expect(page.getByText("Backups aren't set up on this installation.")).toBeVisible();
	const people = page.getByRole('region', { name: 'People' });
	await people
		.getByRole('listitem')
		.filter({ hasText: name })
		.getByRole('button', { name: 'Delete account' })
		.click();
	const sheet = page.getByRole('dialog', { name: `Delete ${name}'s account?` });
	// The question names the person and the count (it once said "Foods you shared", meaning the admin).
	await sheet
		.getByRole('radiogroup', {
			name: `${name} shared 2 foods with other members. Keep them in everyone's search?`
		})
		.getByRole('radio', { name: 'Remove' })
		.click();
	await expect(sheet).toContainText("Meals already logged don't change either way.");
	await expect(sheet.getByRole('button', { name: 'Delete account' })).toBeDisabled();
	await sheet.getByRole('checkbox').check();
	await sheet.getByRole('button', { name: 'Delete account' }).click();
	await expect(people).not.toContainText(name);
	// Listed under Backups (it matters only for a restore), by ID and who deleted it, never by name.
	const deletions = page.getByRole('region', { name: 'Backups' }).getByTestId('deletions');
	await expect(deletions).toContainText(memberId);
	await expect(deletions).toContainText('Deleted by an admin · Shared foods removed too');
	await expect(deletions).not.toContainText(name);
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
	await expect(page.getByText(/^LoseIt · /)).toBeVisible();
	await expect(preview).toContainText('All 4 days match');
	await expect(preview.getByRole('row', { name: /Diary entries/ })).toContainText('18');
	await expect(preview.getByRole('row', { name: /Deleted in LoseIt/ })).toContainText('1');
	await expect(preview).toContainText('First weigh-in');
	await preview.getByRole('radio', { name: 'lb' }).click();
	await expect(preview).toContainText(/First weigh-in: [\d.]+ lb/);
	await preview.getByRole('radio', { name: 'kg' }).click();
	await expect(preview).toContainText(/First weigh-in: [\d.]+ kg/);
	await preview.getByRole('button', { name: /^Import/ }).click();
	await expect(page.getByRole('status')).toContainText('Import finished');
	const day = await apiAs<{ entries: { food: { name: string } | null }[] }>(
		page,
		'GET',
		'/api/v1/diary/2026-01-07'
	);
	expect(day.entries.map((e) => e.food?.name)).toContain('Greek yogurt, plain');
	// Imported carbs state no definition: shown with a note, not left out.
	// The page may still be refreshing after the import, which can interrupt a navigation.
	await expect(() => page.goto('/?date=2026-01-07')).toPass();
	const nutrients = page.getByRole('region', { name: 'Nutrients' });
	await expect(nutrients).toContainText('84.4 g');
	await expect(nutrients).toContainText('Definition not stated (imported)');
});
