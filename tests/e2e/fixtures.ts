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
	await page.context().addCookies([
		{
			name: 'obur_session',
			value: token,
			url: e2eEnv.PUBLIC_ORIGIN,
			httpOnly: true,
			sameSite: 'Lax'
		}
	]);
	return userId;
}
