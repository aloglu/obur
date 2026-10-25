// Passkey journeys with Chromium's virtual authenticator (WebKit has no supported virtual authenticator).
// The steps share one browser context for the admin's "phone" and run in order.
import { expect, test, type Browser, type BrowserContext, type Page } from '@playwright/test';
import postgres from 'postgres';
import { issueSetupLink } from '../../src/lib/server/modules/auth/operator.ts';
import { e2eEnv } from '../../playwright.config.ts';

test.skip(({ browserName }) => browserName !== 'chromium', 'Virtual authenticators need Chromium');
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
	await page.goto('/');
	await page.getByRole('button', { name: 'Sign out' }).click();
	await expect(page).toHaveURL(/\/login$/);
}

async function signIn(page: Page, name: string) {
	await page.goto('/login');
	await page.getByRole('button', { name: 'Sign in with a passkey' }).click();
	await expect(page.getByRole('heading', { name: `Hello, ${name}` })).toBeVisible();
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
	await expect(page.getByRole('heading', { name: `Hello, ${ADMIN}` })).toBeVisible();
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

test('an invited member joins with their own passkey', async ({ browser }) => {
	const { page } = admin;
	await signIn(page, ADMIN);
	await page.goto('/household');
	await page.getByLabel('Who is it for? (optional)').fill('Mehmet');
	await page.getByRole('button', { name: 'Create invite link' }).click();
	const link = (await page.getByTestId('invite-link').textContent())!.trim();
	expect(link).toMatch(/\/join#/);

	const member = await device(browser, e2eEnv.PUBLIC_ORIGIN);
	await member.addAuthenticator();
	await member.page.goto(link);
	await member.page.getByLabel('Your name').fill('Mehmet Öztürk');
	await member.page.getByRole('button', { name: 'Create passkey and join' }).click();
	await saveCodes(member.page);
	await expect(member.page.getByRole('heading', { name: 'Hello, Mehmet Öztürk' })).toBeVisible();
	// Members have no Household page.
	await expect(member.page.getByRole('link', { name: 'Household' })).toHaveCount(0);
	await member.page.goto('/household');
	await expect(member.page).toHaveURL(/\/$/);
	await member.context.close();

	await page.goto('/household');
	await expect(page.getByText('Joined as Mehmet Öztürk')).toBeVisible();
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
	await expect(page.getByRole('heading', { name: `Hello, ${ADMIN}` })).toBeVisible();

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
