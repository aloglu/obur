// Test-runner fixtures that write directly to the disposable e2e database. They create a person and a session
// row, then hand the browser the session cookie: nothing in the application changes, so no login bypass ships.
import { createHash, randomBytes, randomUUID } from 'node:crypto';
import type { Page } from '@playwright/test';
import postgres from 'postgres';
import { e2eEnv } from '../../playwright.config.ts';

const sql = postgres(e2eEnv.DATABASE_MIGRATOR_URL, { max: 2, onnotice: () => {} });

export async function signedInAs(
	page: Page,
	displayName: string,
	role: 'admin' | 'member' = 'member'
): Promise<string> {
	const userId = randomUUID();
	const token = randomBytes(32).toString('base64url');
	await sql`insert into users (id, display_name, role) values (${userId}, ${displayName}, ${role})`;
	await sql`insert into sessions (user_id, token_hash, expires_at)
		values (${userId}, ${createHash('sha256').update(token).digest('hex')}, now() + interval '1 day')`;
	// The browser's time zone as the app would store it on first load. Without it, that first load refreshes the
	// page's data, and a test that navigates at that moment sees the refresh's fallback reload cancel its navigation.
	const zone = await page.evaluate(() => Intl.DateTimeFormat().resolvedOptions().timeZone);
	await page.context().addCookies([
		{
			name: 'obur_session',
			value: token,
			url: e2eEnv.PUBLIC_ORIGIN,
			httpOnly: true,
			sameSite: 'Lax'
		},
		{
			name: 'obur_zone',
			value: encodeURIComponent(zone),
			url: e2eEnv.PUBLIC_ORIGIN,
			sameSite: 'Lax'
		}
	]);
	return userId;
}

/** Calls the app's API as the signed-in browser user, with the Origin header the CSRF check requires. */
export async function apiAs<T>(
	page: Page,
	method: 'POST' | 'GET' | 'PUT',
	path: string,
	data?: unknown
): Promise<T> {
	const response = await page.request.fetch(path, {
		method,
		data,
		headers: { origin: e2eEnv.PUBLIC_ORIGIN }
	});
	if (!response.ok())
		throw new Error(`${method} ${path}: ${response.status()} ${await response.text()}`);
	return (await response.json()) as T;
}

/** Creates a shared food through the API and returns its ID. */
export async function createFood(page: Page, food: Record<string, unknown>): Promise<string> {
	const { id } = await apiAs<{ id: string }>(page, 'POST', '/api/v1/foods', {
		food: { visibility: 'shared', brand: null, servings: [], ...food }
	});
	return id;
}
