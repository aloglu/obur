// Members → Updates (docs/ui.md, "Members"): the check for new versions is off until an admin turns it on, and
// GitHub's list of published versions is played by the stand-in in tests/e2e/speech-stub.ts. The switch is one
// setting for the whole installation, so only one browser runs this, and it leaves the switch off.
import { readFileSync } from 'node:fs';
import { expect, test } from '@playwright/test';
import { SPEECH_STUB } from '../../playwright.config.ts';
import { signedInAs } from './fixtures.ts';

const current: string = JSON.parse(readFileSync('package.json', 'utf8')).version;
const publish = (status: number, names: string[]) =>
	fetch(`${SPEECH_STUB}/next-tags`, {
		method: 'POST',
		body: JSON.stringify({ status, body: names.map((name) => ({ name })) })
	});
const requests = async (): Promise<number> =>
	(await (await fetch(`${SPEECH_STUB}/tag-requests`)).json()).count;

test('an admin turns the check for new versions on, sees a newer one, and turns it off', async ({
	page
}, testInfo) => {
	test.skip(testInfo.project.name !== 'desktop-chromium', 'one installation-wide switch');
	await signedInAs(page, 'Sürüm Yöneticisi', 'admin');
	const before = await requests();
	await page.goto('/members');
	const check = page.getByRole('switch', { name: 'Check for new versions' });
	const facts = page.getByTestId('update-facts');
	await expect(check).not.toBeChecked();
	await expect(facts).toContainText(`This version ${current}`);
	await expect(facts).not.toContainText('Last checked');
	// Nothing was asked while it was off.
	expect(await requests()).toBe(before);

	await publish(200, ['v0.0.1', 'v99.0.0', 'not-a-version']);
	await check.click();
	const notice = page.getByRole('status').filter({ hasText: 'Version 99.0.0 is available' });
	await expect(notice).toBeVisible();
	await expect(notice.getByRole('link', { name: 'How to update' })).toHaveAttribute(
		'href',
		/docs\/install\/updating\.md$/
	);
	expect(await requests()).toBe(before + 1);
	// More points at it; opening pages again within the day asks nobody.
	await page.goto('/more');
	await expect(page.getByRole('link', { name: /Members/ })).toContainText('Update available');
	await page.goto('/members');
	await expect(notice).toBeVisible();
	expect(await requests()).toBe(before + 1);

	await check.click();
	await expect(notice).toHaveCount(0);
	await expect(facts).not.toContainText('Last checked');
	await page.goto('/more');
	await expect(page.getByRole('link', { name: /Members/ })).not.toContainText('Update available');

	// GitHub away: said plainly, nothing invented.
	await publish(503, []);
	await page.goto('/members');
	await check.click();
	await expect(facts).toContainText("GitHub couldn't be reached");
	await expect(notice).toHaveCount(0);
	await check.click();
	await expect(facts).not.toContainText('Last checked');
	await publish(200, []);
});
