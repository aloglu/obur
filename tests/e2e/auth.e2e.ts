// Passkey journeys with Chromium's virtual authenticator (the auth-journey project in playwright.config.ts).
// The steps share one browser context for the admin's "phone" and run in order.
import { expect, test, type Browser, type BrowserContext, type Page } from '@playwright/test';
import postgres from 'postgres';
import { issueSetupLink } from '../../src/lib/server/modules/auth/operator.ts';
import { e2eEnv } from '../../playwright.config.ts';

test.describe.configure({ mode: 'serial' });

interface Device {
	context: BrowserContext;
	page: Page;
	addAuthenticator: () => Promise<string>;
	removeAuthenticator: (id: string) => Promise<void>;
	credentials: (id: string) => Promise<unknown[]>;
	restore: (id: string, credentials: unknown[]) => Promise<void>;
}

async function device(browser: Browser, baseURL: string): Promise<Device> {
	const context = await browser.newContext({ baseURL });
	await context.grantPermissions(['clipboard-read', 'clipboard-write']);
	const page = await context.newPage();
	const cdp = await context.newCDPSession(page);
	await cdp.send('WebAuthn.enable');
	return {
		context,
		page,
		addAuthenticator: async () =>
			(
				await cdp.send('WebAuthn.addVirtualAuthenticator', {
					options: {
						protocol: 'ctap2',
						transport: 'internal',
						hasResidentKey: true,
						hasUserVerification: true,
						isUserVerified: true,
						automaticPresenceSimulation: true
					}
				})
			).authenticatorId,
		removeAuthenticator: async (authenticatorId) => {
			await cdp.send('WebAuthn.removeVirtualAuthenticator', { authenticatorId });
		},
		credentials: async (authenticatorId) =>
			(await cdp.send('WebAuthn.getCredentials', { authenticatorId })).credentials,
		restore: async (authenticatorId, credentials) => {
			for (const credential of credentials) {
				await cdp.send('WebAuthn.addCredential', {
					authenticatorId,
					credential: credential as never
				});
			}
		}
	};
}

async function saveCodes(page: Page): Promise<string[]> {
	const list = page.getByRole('list', { name: 'Save your recovery codes' });
	await expect(list.getByRole('listitem')).toHaveCount(10);
	const codes = await list.getByRole('listitem').allTextContents();
	await expect(page.getByRole('button', { name: 'Continue' })).toBeDisabled();
	await page.getByLabel("I've saved these codes").check();
	await page.getByRole('button', { name: 'Continue' }).click();
	return codes;
}

async function signOut(page: Page) {
	await page.goto('/more');
	await page.getByRole('button', { name: 'Sign out' }).click();
	await expect(page).toHaveURL(/\/login$/);
}

/** Lands on Today and confirms who is signed in. */
async function expectSignedIn(page: Page, name: string) {
	await expect(page.getByRole('heading', { level: 1, name: 'Today' })).toBeVisible();
	await page.goto('/more');
	await expect(page.getByText(`Signed in as ${name}`)).toBeVisible();
}

async function signIn(page: Page, name: string) {
	await page.goto('/login');
	await page.getByRole('button', { name: 'Sign in with a passkey' }).click();
	await expectSignedIn(page, name);
}

const ADMIN = 'Ayşe Yılmaz-Karaosmanoğlu';
let admin: Device;
let phone: string;
let setupLink = '';
let adminCodes: string[] = [];

test.beforeAll(async ({ browser }) => {
	admin = await device(browser, e2eEnv.PUBLIC_ORIGIN);
	phone = await admin.addAuthenticator();
	const sql = postgres(e2eEnv.DATABASE_MIGRATOR_URL, { max: 1, onnotice: () => {} });
	setupLink = await issueSetupLink(sql, e2eEnv.PUBLIC_ORIGIN);
	await sql.end();
});

test.afterAll(async () => {
	await admin?.context.close();
});

test('the first admin sets up with a passkey and receives recovery codes', async () => {
	const { page } = admin;
	await page.goto(setupLink);
	await expect(page).not.toHaveURL(/#/); // the token is removed from the address bar
	await page.getByLabel('Your name').fill(ADMIN);
	await page.getByRole('button', { name: 'Create admin passkey' }).click();
	adminCodes = await saveCodes(page);
	await expectSignedIn(page, ADMIN);
});

test('the setup link works only once', async () => {
	const { page } = admin;
	await signOut(page);
	await page.goto(setupLink);
	await page.getByLabel('Your name').fill('Someone else');
	await page.getByRole('button', { name: 'Create admin passkey' }).click();
	await expect(page.getByRole('alert')).toContainText('already been used');
});

test('the admin signs in again and adds a security key', async () => {
	const { page } = admin;
	await signIn(page, ADMIN);

	// A second authenticator stands in for a YubiKey. Remove the phone so the browser uses the key.
	const phoneCredentials = await admin.credentials(phone);
	await admin.removeAuthenticator(phone);
	const key = await admin.addAuthenticator();
	await page.goto('/settings/security');
	await page.getByLabel('Name this passkey').fill('YubiKey');
	await page.getByRole('button', { name: 'Add a passkey or security key' }).click();
	await expect(page.getByText('YubiKey', { exact: true })).toBeVisible();

	// The key alone can sign in.
	await signOut(page);
	await signIn(page, ADMIN);

	// Put the phone back for the next steps.
	await admin.removeAuthenticator(key);
	phone = await admin.addAuthenticator();
	await admin.restore(phone, phoneCredentials);
});

test('on a new device, one passkey signs in even with a chosen app icon', async () => {
	const { page, context } = admin;
	// Owner report 2026-11-09: the account's icon arrived while still on the sign-in page, which reloaded for the
	// Home Screen icon and asked for the passkey a second time.
	const origin = new URL(page.url()).origin;
	const chosen = await page.request.patch('/api/v1/profile/preferences', {
		headers: { origin },
		data: { appIcon: 'sade' }
	});
	expect(chosen.ok()).toBe(true);
	await context.clearCookies(); // a browser that has never seen this account
	let prompts = 0;
	page.on('request', (r) => {
		if (r.url().endsWith('/api/v1/auth/login/options')) prompts += 1;
	});
	await page.goto('/login');
	await page.getByRole('button', { name: 'Sign in with a passkey' }).click();
	await expect(page.getByRole('heading', { level: 1, name: 'Today' })).toBeVisible();
	await page.waitForTimeout(500); // a reload in place would show the sign-in page again by now
	await expect(page).not.toHaveURL(/\/login/);
	expect(prompts).toBe(1);
	// Signed in already: the sign-in page goes straight to Today.
	await page.goto('/login');
	await expect(page.getByRole('heading', { level: 1, name: 'Today' })).toBeVisible();
	await page.request.patch('/api/v1/profile/preferences', {
		headers: { origin },
		data: { appIcon: 'pazar' }
	});
});

test('an admin setting asks for the passkey again once the last check is old', async () => {
	const { page } = admin;
	// Owner report 2026-11-09: the Personal AI keys switch said "couldn't be saved" later in a session.
	const sql = postgres(e2eEnv.DATABASE_MIGRATOR_URL, { max: 1, onnotice: () => {} });
	await sql`update sessions set verified_at = now() - interval '1 hour'`;
	await sql.end();
	await page.goto('/members');
	const keys = page.getByRole('switch', { name: 'Personal AI keys' });
	await expect(keys).toBeChecked();
	const saved = () =>
		page.waitForResponse((r) => r.url().endsWith('/personal-keys') && r.status() === 200);
	await Promise.all([saved(), keys.click()]);
	await page.reload();
	await expect(keys).not.toBeChecked();
	await Promise.all([saved(), keys.click()]);
	await page.reload();
	await expect(keys).toBeChecked();
	await signOut(page);
});

test('an invited member joins with their own passkey', async ({ browser }) => {
	const { page } = admin;
	await signIn(page, ADMIN);
	await page.goto('/members');
	await page.getByLabel('Who is it for? (optional)').fill('Mehmet');
	await page.getByRole('button', { name: 'Create invite link' }).click();
	await expect(page.getByTestId('invite-link')).toContainText('/join#');
	const link = (await page.getByTestId('invite-link').textContent())!.trim();
	expect(link).toMatch(/\/join#/);

	const member = await device(browser, e2eEnv.PUBLIC_ORIGIN);
	await member.addAuthenticator();
	await member.page.goto(link);
	await member.page.getByLabel('Your name').fill('Mehmet Öztürk');
	await member.page.getByRole('button', { name: 'Create passkey and join' }).click();
	await saveCodes(member.page);
	await expectSignedIn(member.page, 'Mehmet Öztürk');
	// Non-admins have no Members page.
	await expect(member.page.getByRole('link', { name: 'Members' })).toHaveCount(0);
	await member.page.goto('/members');
	await expect(member.page).toHaveURL(/\/$/);
	await member.context.close();

	// The page's old address (Household until 2026-11-14) still leads to it.
	await page.goto('/household');
	await expect(page).toHaveURL(/\/members$/);
	// The person is under People; their used invite is no longer listed.
	await expect(page.getByRole('region', { name: 'People' })).toContainText('Mehmet Öztürk');
	await expect(page.getByText('For Mehmet')).toHaveCount(0);
});

test('a lost phone is replaced with a recovery code, and the old passkey stops working', async () => {
	const { page } = admin;
	await signOut(page);
	const lost = await admin.credentials(phone);
	await admin.removeAuthenticator(phone);
	const newPhone = await admin.addAuthenticator();

	await page.goto('/recover');
	await page.getByLabel('Recovery code').fill(adminCodes[2].toLowerCase());
	await page.getByRole('button', { name: 'Continue' }).click();
	await expect(page.getByText('signs you out everywhere')).toBeVisible();
	// Recovery sessions cannot reach the rest of the app.
	await page.goto('/settings/security');
	await expect(page).toHaveURL(/\/recover$/);
	await page.getByRole('button', { name: 'Create new passkey' }).click();
	await saveCodes(page);
	await expectSignedIn(page, ADMIN);

	// The same code cannot be used twice.
	await signOut(page);
	await page.goto('/recover');
	await page.getByLabel('Recovery code').fill(adminCodes[2]);
	await page.getByRole('button', { name: 'Continue' }).click();
	await expect(page.getByRole('alert')).toContainText('already used');

	// The old phone's passkey (and the YubiKey) were revoked by recovery.
	await admin.removeAuthenticator(newPhone);
	const oldPhone = await admin.addAuthenticator();
	await admin.restore(oldPhone, lost);
	await page.goto('/login');
	await page.getByRole('button', { name: 'Sign in with a passkey' }).click();
	await expect(page.getByRole('alert')).toContainText("isn't registered here");
});
