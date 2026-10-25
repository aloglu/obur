// Database operations for authentication. Before an identity exists, only the reviewed SECURITY DEFINER
// functions in drizzle/0003_auth_rls.sql are called; afterwards everything runs through withUser() and RLS.
import { and, asc, count, desc, eq, isNull, ne, sql } from 'drizzle-orm';
import { withUser, type Database } from '../../db/identity.ts';
import { POLICY } from './policy.ts';
import { credentials, invites, recoveryCodes, sessions, users } from './schema.ts';
import { hashRecoveryCode, hashToken, newRecoveryCodes, newToken } from './tokens.ts';

export type AuthErrorCode =
	| 'setup_unavailable'
	| 'not_verified'
	| 'challenge_expired'
	| 'recent_auth_required'
	| 'forbidden'
	| 'rate_limited'
	| 'invite_unavailable'
	| 'recovery_unavailable'
	| 'unknown_credential'
	| 'last_credential'
	| 'not_found';

export class AuthError extends Error {
	constructor(readonly code: AuthErrorCode) {
		super(code);
	}
}

export interface NewCredential {
	id: string;
	publicKey: string;
	counter: number;
	transports: string[];
	deviceType: 'singleDevice' | 'multiDevice';
	backedUp: boolean;
	label: string;
}

export interface SessionRecord {
	sessionId: string;
	userId: string;
	kind: 'normal' | 'recovery';
	role: 'admin' | 'member';
	displayName: string;
	lastSeenAt: Date;
	expiresAt: Date;
	verifiedAt: Date;
}

/** Raised by plpgsql functions with RAISE EXCEPTION '<code>' USING ERRCODE = 'P0001'. */
function raisedCode(e: unknown): string | undefined {
	const err = e as { code?: string; message?: string; cause?: { code?: string; message?: string } };
	const inner = err.cause ?? err;
	return inner.code === 'P0001' ? inner.message : undefined;
}

/** Drizzle's sql template expands arrays into lists, so pass text arrays as one escaped array literal. */
export function textArrayLiteral(values: string[]): string {
	return `{${values.map((v) => `"${v.replace(/["\\]/g, '\\$&')}"`).join(',')}}`;
}

const credentialArgs = (c: NewCredential) =>
	sql`${c.id}, ${c.publicKey}, ${c.counter}::bigint, ${textArrayLiteral(c.transports)}::text[], ${c.deviceType}, ${c.backedUp}, ${c.label}`;

export function createAuthStore(db: Database, now: () => Date = () => new Date()) {
	const expiresIn = (ms: number) => new Date(now().getTime() + ms);

	async function newSession(userId: string): Promise<string> {
		const token = newToken();
		await withUser(db, userId, (tx) =>
			tx.insert(sessions).values({
				userId,
				tokenHash: hashToken(token),
				expiresAt: expiresIn(POLICY.sessionAbsoluteMs)
			})
		);
		return token;
	}

	async function storeRecoveryCodes(userId: string): Promise<string[]> {
		const codes = newRecoveryCodes();
		await withUser(db, userId, async (tx) => {
			await tx.delete(recoveryCodes).where(eq(recoveryCodes.userId, userId));
			await tx
				.insert(recoveryCodes)
				.values(codes.map((c) => ({ userId, codeHash: hashRecoveryCode(c.replace(/-/g, '')) })));
		});
		return codes;
	}

	return {
		async setupAvailable(token: string): Promise<boolean> {
			const [row] = await db.execute<{ ok: boolean }>(
				sql`select auth_bootstrap_available(${hashToken(token)}) as ok`
			);
			return row.ok;
		},

		/** Creates the first admin; returns a session token and their recovery codes. */
		async bootstrapAdmin(token: string, userId: string, displayName: string, c: NewCredential) {
			try {
				await db.execute(
					sql`select auth_bootstrap_admin(${hashToken(token)}, ${userId}::uuid, ${displayName}, ${credentialArgs(c)})`
				);
			} catch (e) {
				if (raisedCode(e) === 'bootstrap_unavailable') throw new AuthError('setup_unavailable');
				throw e;
			}
			return {
				sessionToken: await newSession(userId),
				recoveryCodes: await storeRecoveryCodes(userId)
			};
		},

		async inviteAvailable(token: string): Promise<boolean> {
			const [row] = await db.execute<{ ok: boolean }>(
				sql`select auth_invite_available(${hashToken(token)}) as ok`
			);
			return row.ok;
		},

		async redeemInvite(token: string, userId: string, displayName: string, c: NewCredential) {
			try {
				await db.execute(
					sql`select auth_redeem_invite(${hashToken(token)}, ${userId}::uuid, ${displayName}, ${credentialArgs(c)})`
				);
			} catch (e) {
				if (raisedCode(e) === 'invite_unavailable') throw new AuthError('invite_unavailable');
				throw e;
			}
			return {
				sessionToken: await newSession(userId),
				recoveryCodes: await storeRecoveryCodes(userId)
			};
		},

		async findCredential(credentialId: string) {
			const [row] = await db.execute<{
				user_id: string;
				public_key: string;
				counter: string | number;
				transports: string[];
			}>(sql`select * from auth_find_credential(${credentialId})`);
			if (!row) return undefined;
			return {
				userId: row.user_id,
				publicKey: row.public_key,
				counter: Number(row.counter),
				transports: row.transports
			};
		},

		/** Records a verified assertion's signature counter. */
		async recordAssertion(userId: string, credentialId: string, counter: number): Promise<void> {
			await withUser(db, userId, (tx) =>
				tx
					.update(credentials)
					.set({ counter, lastUsedAt: now() })
					.where(eq(credentials.id, credentialId))
			);
		},

		/** After a verified sign-in: records the counter and opens a session. */
		async completeSignIn(userId: string, credentialId: string, counter: number): Promise<string> {
			await this.recordAssertion(userId, credentialId, counter);
			return newSession(userId);
		},

		async lookupSession(token: string): Promise<SessionRecord | undefined> {
			const [row] = await db.execute<{
				session_id: string;
				user_id: string;
				kind: SessionRecord['kind'];
				role: SessionRecord['role'];
				display_name: string;
				last_seen_at: Date;
				expires_at: Date;
				verified_at: Date;
			}>(sql`select * from auth_session_lookup(${hashToken(token)})`);
			if (!row) return undefined;
			return {
				sessionId: row.session_id,
				userId: row.user_id,
				kind: row.kind,
				role: row.role,
				displayName: row.display_name,
				lastSeenAt: new Date(row.last_seen_at),
				expiresAt: new Date(row.expires_at),
				verifiedAt: new Date(row.verified_at)
			};
		},

		async touchSession(userId: string, sessionId: string): Promise<void> {
			await withUser(db, userId, (tx) =>
				tx.update(sessions).set({ lastSeenAt: now() }).where(eq(sessions.id, sessionId))
			);
		},

		async markVerified(userId: string, sessionId: string): Promise<void> {
			await withUser(db, userId, (tx) =>
				tx.update(sessions).set({ verifiedAt: now() }).where(eq(sessions.id, sessionId))
			);
		},

		async deleteSession(userId: string, sessionId: string): Promise<void> {
			await withUser(db, userId, (tx) => tx.delete(sessions).where(eq(sessions.id, sessionId)));
		},

		async signOutOtherSessions(userId: string, keepSessionId: string): Promise<number> {
			const removed = await withUser(db, userId, (tx) =>
				tx
					.delete(sessions)
					.where(and(eq(sessions.userId, userId), ne(sessions.id, keepSessionId)))
					.returning({ id: sessions.id })
			);
			return removed.length;
		},

		async listCredentials(userId: string) {
			return withUser(db, userId, (tx) =>
				tx
					.select({
						id: credentials.id,
						label: credentials.label,
						deviceType: credentials.deviceType,
						backedUp: credentials.backedUp,
						transports: credentials.transports,
						createdAt: credentials.createdAt,
						lastUsedAt: credentials.lastUsedAt
					})
					.from(credentials)
					.orderBy(asc(credentials.createdAt))
			);
		},

		async credentialIds(userId: string) {
			const rows = await withUser(db, userId, (tx) =>
				tx.select({ id: credentials.id, transports: credentials.transports }).from(credentials)
			);
			return rows;
		},

		async addCredential(userId: string, c: NewCredential): Promise<void> {
			await withUser(db, userId, (tx) => tx.insert(credentials).values({ ...c, userId }));
		},

		/** Removes a credential, refusing to remove the last one (recovery would be the only way back). */
		async removeCredential(userId: string, credentialId: string): Promise<void> {
			await withUser(db, userId, async (tx) => {
				// Lock the person's credentials so two concurrent removals cannot both pass the check.
				const owned = await tx
					.select({ id: credentials.id })
					.from(credentials)
					.where(eq(credentials.userId, userId))
					.for('update');
				if (!owned.some((c) => c.id === credentialId)) throw new AuthError('not_found');
				if (owned.length <= 1) throw new AuthError('last_credential');
				await tx.delete(credentials).where(eq(credentials.id, credentialId));
			});
		},

		replaceRecoveryCodes: storeRecoveryCodes,

		async unusedRecoveryCodeCount(userId: string): Promise<number> {
			const [row] = await withUser(db, userId, (tx) =>
				tx.select({ n: count() }).from(recoveryCodes).where(isNull(recoveryCodes.usedAt))
			);
			return row.n;
		},

		/** Consumes a recovery code (normalized) and returns a recovery-session token, or undefined. */
		async beginRecoveryWithCode(normalizedCode: string): Promise<string | undefined> {
			const token = newToken();
			const [row] = await db.execute<{ user_id: string | null }>(
				sql`select auth_begin_recovery_code(${hashRecoveryCode(normalizedCode)}, ${hashToken(token)}, ${expiresIn(POLICY.recoverySessionMs).toISOString()}::timestamptz) as user_id`
			);
			return row.user_id ? token : undefined;
		},

		async beginRecoveryWithLink(linkToken: string): Promise<string | undefined> {
			const token = newToken();
			const [row] = await db.execute<{ user_id: string | null }>(
				sql`select auth_begin_recovery_link(${hashToken(linkToken)}, ${hashToken(token)}, ${expiresIn(POLICY.recoverySessionMs).toISOString()}::timestamptz) as user_id`
			);
			return row.user_id ? token : undefined;
		},

		/** Replaces every credential, session and code of the recovering person in one transaction. */
		async completeRecovery(recoveryToken: string, c: NewCredential) {
			const sessionToken = newToken();
			const codes = newRecoveryCodes();
			const hashes = codes.map((code) => hashRecoveryCode(code.replace(/-/g, '')));
			try {
				await db.execute(
					sql`select auth_complete_recovery(${hashToken(recoveryToken)}, ${hashToken(sessionToken)}, ${expiresIn(POLICY.sessionAbsoluteMs).toISOString()}::timestamptz, ${credentialArgs(c)}, ${textArrayLiteral(hashes)}::text[])`
				);
			} catch (e) {
				if (raisedCode(e) === 'recovery_unavailable') throw new AuthError('recovery_unavailable');
				throw e;
			}
			return { sessionToken, recoveryCodes: codes };
		},

		/** Admin only (enforced by RLS); returns the invite token, shown once. */
		async createInvite(adminId: string, note: string | null): Promise<string> {
			const token = newToken();
			await withUser(db, adminId, (tx) =>
				tx.insert(invites).values({
					tokenHash: hashToken(token),
					note,
					createdBy: adminId,
					expiresAt: expiresIn(POLICY.inviteMs)
				})
			);
			return token;
		},

		async listInvites(adminId: string) {
			return withUser(db, adminId, (tx) =>
				tx
					.select({
						id: invites.id,
						note: invites.note,
						createdAt: invites.createdAt,
						expiresAt: invites.expiresAt,
						usedAt: invites.usedAt,
						revokedAt: invites.revokedAt,
						usedByName: users.displayName
					})
					.from(invites)
					.leftJoin(users, eq(users.id, invites.usedBy))
					.orderBy(desc(invites.createdAt))
			);
		},

		async revokeInvite(adminId: string, inviteId: string): Promise<boolean> {
			const rows = await withUser(db, adminId, (tx) =>
				tx
					.update(invites)
					.set({ revokedAt: now() })
					.where(and(eq(invites.id, inviteId), isNull(invites.usedAt), isNull(invites.revokedAt)))
					.returning({ id: invites.id })
			);
			return rows.length === 1;
		}
	};
}

export type AuthStore = ReturnType<typeof createAuthStore>;
