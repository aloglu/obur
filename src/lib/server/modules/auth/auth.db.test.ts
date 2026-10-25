// Authentication data rules against real PostgreSQL, run as the runtime role.
import { randomBytes, randomUUID } from 'node:crypto';
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { afterAll, beforeEach, describe, expect, inject, it } from 'vitest';
import { issueRecoveryLink, issueSetupLink, OperatorError } from './operator.ts';
import { AuthError, createAuthStore, type NewCredential } from './store.ts';

const urls = inject('db');
const quiet = { onnotice: () => {} };
const admin = postgres(urls.admin, { max: 1, ...quiet });
const migrator = postgres(urls.migrator, { max: 1, ...quiet });
const appSql = postgres(urls.app, { max: 4, ...quiet });
const store = createAuthStore(drizzle(appSql));
const ORIGIN = 'https://obur.example.com';

const credential = (label = 'Phone'): NewCredential => ({
	id: randomBytes(16).toString('base64url'),
	publicKey: randomBytes(65).toString('base64url'),
	counter: 0,
	transports: ['internal'],
	deviceType: 'multiDevice',
	backedUp: true,
	label
});
const tokenOf = (link: string) => link.slice(link.indexOf('#') + 1);

async function errorCode(promise: Promise<unknown>): Promise<string | undefined> {
	try {
		await promise;
	} catch (e) {
		if (e instanceof AuthError) return e.code;
		const err = e as { code?: string; cause?: { code?: string } };
		return err.cause?.code ?? err.code;
	}
	return undefined;
}

/** Creates the first admin through the real setup path. */
async function setUpAdmin() {
	const token = tokenOf(await issueSetupLink(migrator, ORIGIN));
	const id = randomUUID();
	const cred = credential();
	const result = await store.bootstrapAdmin(token, id, 'Admin', cred);
	return { id, cred, ...result };
}

async function inviteMember(adminId: string, name = 'Member') {
	const token = await store.createInvite(adminId, null);
	const id = randomUUID();
	const cred = credential();
	const result = await store.redeemInvite(token, id, name, cred);
	return { id, cred, ...result };
}

beforeEach(async () => {
	await admin`truncate users, bootstrap_tokens cascade`;
});

afterAll(async () => {
	await Promise.all([admin.end(), migrator.end(), appSql.end()]);
});

describe('first admin setup', () => {
	it('creates an admin once with a session and ten recovery codes', async () => {
		const link = await issueSetupLink(migrator, ORIGIN);
		expect(link.startsWith(`${ORIGIN}/setup#`)).toBe(true);
		const token = tokenOf(link);
		expect(await store.setupAvailable(token)).toBe(true);

		const id = randomUUID();
		const result = await store.bootstrapAdmin(token, id, 'Admin', credential());
		expect(result.recoveryCodes).toHaveLength(10);
		const session = await store.lookupSession(result.sessionToken);
		expect(session).toMatchObject({ userId: id, role: 'admin', kind: 'normal' });

		expect(await store.setupAvailable(token)).toBe(false);
		expect(await errorCode(store.bootstrapAdmin(token, randomUUID(), 'Again', credential()))).toBe(
			'setup_unavailable'
		);
		await expect(issueSetupLink(migrator, ORIGIN)).rejects.toBeInstanceOf(OperatorError);
	});

	it('lets only one of two simultaneous setups succeed', async () => {
		const token = tokenOf(await issueSetupLink(migrator, ORIGIN));
		const results = await Promise.allSettled([
			store.bootstrapAdmin(token, randomUUID(), 'A', credential()),
			store.bootstrapAdmin(token, randomUUID(), 'B', credential())
		]);
		expect(results.map((r) => r.status).sort()).toEqual(['fulfilled', 'rejected']);
		const [{ n }] = await admin`select count(*)::int as n from users`;
		expect(n).toBe(1);
	});

	it('rejects an expired setup token and invalidates older links', async () => {
		const old = tokenOf(await issueSetupLink(migrator, ORIGIN));
		const fresh = tokenOf(await issueSetupLink(migrator, ORIGIN));
		expect(await store.setupAvailable(old)).toBe(false);
		await admin`update bootstrap_tokens set expires_at = now() - interval '1 second'`;
		expect(await store.setupAvailable(fresh)).toBe(false);
		expect(await errorCode(store.bootstrapAdmin(fresh, randomUUID(), 'A', credential()))).toBe(
			'setup_unavailable'
		);
	});
});

describe('invites', () => {
	it('lets an admin invite a member exactly once', async () => {
		const a = await setUpAdmin();
		const token = await store.createInvite(a.id, 'for Ayşe');
		expect(await store.inviteAvailable(token)).toBe(true);
		const memberId = randomUUID();
		await store.redeemInvite(token, memberId, 'Ayşe', credential());
		const [row] = await admin`select role from users where id = ${memberId}`;
		expect(row.role).toBe('member');
		expect(await store.inviteAvailable(token)).toBe(false);
		expect(await errorCode(store.redeemInvite(token, randomUUID(), 'Twice', credential()))).toBe(
			'invite_unavailable'
		);
		const list = await store.listInvites(a.id);
		expect(list).toMatchObject([{ note: 'for Ayşe', usedByName: 'Ayşe' }]);
	});

	it('redeems an invite only once under concurrency', async () => {
		const a = await setUpAdmin();
		const token = await store.createInvite(a.id, null);
		const results = await Promise.allSettled([
			store.redeemInvite(token, randomUUID(), 'One', credential()),
			store.redeemInvite(token, randomUUID(), 'Two', credential())
		]);
		expect(results.map((r) => r.status).sort()).toEqual(['fulfilled', 'rejected']);
	});

	it('refuses revoked and expired invites', async () => {
		const a = await setUpAdmin();
		const revoked = await store.createInvite(a.id, null);
		const [{ id }] = await admin`select id from invites order by created_at desc limit 1`;
		expect(await store.revokeInvite(a.id, id)).toBe(true);
		expect(await store.inviteAvailable(revoked)).toBe(false);

		const expired = await store.createInvite(a.id, null);
		await admin`update invites set expires_at = now() - interval '1 second' where revoked_at is null`;
		expect(await errorCode(store.redeemInvite(expired, randomUUID(), 'Late', credential()))).toBe(
			'invite_unavailable'
		);
	});

	it('lets admins, but not members, see other members', async () => {
		const a = await setUpAdmin();
		const m = await inviteMember(a.id, 'Ayşe');
		const visible = async (id: string) =>
			(
				await appSql.begin(async (tx) => {
					await tx`select set_config('app.user_id', ${id}, true)`;
					return tx`select display_name from users order by display_name`;
				})
			).map((r) => r.display_name);
		expect(await visible(a.id)).toEqual(['Admin', 'Ayşe']);
		expect(await visible(m.id)).toEqual(['Ayşe']);
	});

	it('does not let members create or see invites', async () => {
		const a = await setUpAdmin();
		await store.createInvite(a.id, null);
		const m = await inviteMember(a.id);
		expect(await errorCode(store.createInvite(m.id, null))).toBe('42501');
		expect(await store.listInvites(m.id)).toEqual([]);
	});
});

describe('sign-in and sessions', () => {
	it('finds a credential, records the counter and opens a session', async () => {
		const a = await setUpAdmin();
		expect(await store.findCredential(a.cred.id)).toMatchObject({ userId: a.id, counter: 0 });
		const token = await store.completeSignIn(a.id, a.cred.id, 7);
		expect(await store.findCredential(a.cred.id)).toMatchObject({ counter: 7 });
		expect(await store.lookupSession(token)).toMatchObject({ userId: a.id });
		expect(await store.lookupSession('not-a-real-token')).toBeUndefined();
	});

	it('hides disabled accounts from sign-in and session lookup', async () => {
		const a = await setUpAdmin();
		const m = await inviteMember(a.id);
		await admin`update users set disabled_at = now() where id = ${m.id}`;
		expect(await store.findCredential(m.cred.id)).toBeUndefined();
		expect(await store.lookupSession(m.sessionToken)).toBeUndefined();
	});

	it('does not return expired sessions', async () => {
		const a = await setUpAdmin();
		await admin`update sessions set expires_at = now() - interval '1 second'`;
		expect(await store.lookupSession(a.sessionToken)).toBeUndefined();
	});

	it('keeps credentials and sessions per person', async () => {
		const a = await setUpAdmin();
		const m = await inviteMember(a.id);
		expect((await store.listCredentials(m.id)).map((c) => c.id)).toEqual([m.cred.id]);
		const adminSession = await store.lookupSession(a.sessionToken);
		await store.deleteSession(m.id, adminSession!.sessionId);
		expect(await store.lookupSession(a.sessionToken)).toBeDefined();
		expect(await errorCode(store.removeCredential(m.id, a.cred.id))).toBe('not_found');
	});

	it('refuses to remove the last credential', async () => {
		const a = await setUpAdmin();
		expect(await errorCode(store.removeCredential(a.id, a.cred.id))).toBe('last_credential');
		const second = credential('YubiKey');
		await store.addCredential(a.id, second);
		await store.removeCredential(a.id, a.cred.id);
		expect((await store.listCredentials(a.id)).map((c) => c.label)).toEqual(['YubiKey']);
	});

	it('does not let the app create recovery sessions or read operator tables directly', async () => {
		const a = await setUpAdmin();
		const insert = appSql.begin(async (tx) => {
			await tx`select set_config('app.user_id', ${a.id}, true)`;
			await tx`insert into sessions (user_id, token_hash, kind, expires_at)
				values (${a.id}, 'x', 'recovery', now() + interval '1 hour')`;
		});
		expect(await errorCode(insert)).toBe('42501');
		expect(await errorCode(appSql`select * from recovery_links`)).toBe('42501');
		expect(await errorCode(appSql`select * from bootstrap_tokens`)).toBe('42501');
	});
});

describe('recovery', () => {
	it('uses a recovery code once and replaces everything on completion', async () => {
		const a = await setUpAdmin();
		await store.addCredential(a.id, credential('YubiKey'));
		const code = a.recoveryCodes[3].replace(/-/g, '');

		const recovery = await store.beginRecoveryWithCode(code);
		expect(recovery).toBeDefined();
		expect(await store.beginRecoveryWithCode(code)).toBeUndefined();
		expect(await store.lookupSession(recovery!)).toMatchObject({ kind: 'recovery', userId: a.id });

		const replacement = credential('New phone');
		const done = await store.completeRecovery(recovery!, replacement);
		expect(await store.lookupSession(a.sessionToken)).toBeUndefined();
		expect(await store.lookupSession(recovery!)).toBeUndefined();
		expect(await store.lookupSession(done.sessionToken)).toMatchObject({ kind: 'normal' });
		expect((await store.listCredentials(a.id)).map((c) => c.label)).toEqual(['New phone']);
		expect(await store.unusedRecoveryCodeCount(a.id)).toBe(10);
		expect(await store.beginRecoveryWithCode(a.recoveryCodes[4].replace(/-/g, ''))).toBeUndefined();
	});

	it('consumes a code only once under concurrency', async () => {
		const a = await setUpAdmin();
		const code = a.recoveryCodes[0].replace(/-/g, '');
		const tokens = await Promise.all([
			store.beginRecoveryWithCode(code),
			store.beginRecoveryWithCode(code),
			store.beginRecoveryWithCode(code)
		]);
		expect(tokens.filter(Boolean)).toHaveLength(1);
	});

	it('accepts an operator recovery link once and only before it expires', async () => {
		const a = await setUpAdmin();
		const m = await inviteMember(a.id, 'Ayşe');
		const { link, displayName } = await issueRecoveryLink(migrator, ORIGIN, 'Ayşe');
		expect(displayName).toBe('Ayşe');
		expect(await store.beginRecoveryWithLink(tokenOf(link))).toBeDefined();
		expect(await store.beginRecoveryWithLink(tokenOf(link))).toBeUndefined();

		const late = await issueRecoveryLink(migrator, ORIGIN, m.id);
		await admin`update recovery_links set expires_at = now() - interval '1 second' where used_at is null`;
		expect(await store.beginRecoveryWithLink(tokenOf(late.link))).toBeUndefined();
	});

	it('cannot complete recovery with a normal session', async () => {
		const a = await setUpAdmin();
		expect(await errorCode(store.completeRecovery(a.sessionToken, credential()))).toBe(
			'recovery_unavailable'
		);
	});

	it('does not start recovery for a disabled account', async () => {
		const a = await setUpAdmin();
		const m = await inviteMember(a.id);
		await admin`update users set disabled_at = now() where id = ${m.id}`;
		expect(await store.beginRecoveryWithCode(m.recoveryCodes[0].replace(/-/g, ''))).toBeUndefined();
	});
});
