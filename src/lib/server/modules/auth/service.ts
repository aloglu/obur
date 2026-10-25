// Passkey ceremonies and sign-in rules on top of the auth store (docs/design.md, "Passkeys and recovery").
import { randomUUID } from 'node:crypto';
import {
	generateAuthenticationOptions,
	generateRegistrationOptions,
	verifyAuthenticationResponse,
	verifyRegistrationResponse,
	type AuthenticationResponseJSON,
	type AuthenticatorTransportFuture,
	type RegistrationResponseJSON
} from '@simplewebauthn/server';
import { ChallengeStore, type ChallengePurpose } from './challenges.ts';
import { POLICY, recentlyVerified, sessionUsable } from './policy.ts';
import { RateLimiter } from './rate-limit.ts';
import { AuthError, type AuthStore, type NewCredential, type SessionRecord } from './store.ts';
import { hashToken, normalizeRecoveryCode } from './tokens.ts';

export interface AuthConfig {
	origin: string;
	rpId: string;
	rpName: string;
}

const MINUTES_15 = 15 * 60_000;

const uuidBytes = (id: string) => Uint8Array.from(Buffer.from(id.replace(/-/g, ''), 'hex'));
const bytesToUuid = (bytes: Buffer) => {
	const hex = bytes.toString('hex');
	return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
};

export function cleanDisplayName(input: string): string | undefined {
	const name = input.normalize('NFC').replace(/\s+/g, ' ').trim();
	return name.length >= 1 && name.length <= 80 ? name : undefined;
}

export function cleanLabel(input: string | undefined, fallback: string): string {
	const label = (input ?? '').normalize('NFC').replace(/\s+/g, ' ').trim().slice(0, 40);
	return label || fallback;
}

export function createAuthService(
	store: AuthStore,
	config: AuthConfig,
	options: { now?: () => Date; challenges?: ChallengeStore } = {}
) {
	const now = options.now ?? (() => new Date());
	const challenges = options.challenges ?? new ChallengeStore();
	const limits = {
		loginIp: new RateLimiter(30, MINUTES_15),
		loginAccount: new RateLimiter(20, MINUTES_15),
		enrolIp: new RateLimiter(20, MINUTES_15),
		recoveryIp: new RateLimiter(10, MINUTES_15)
	};
	const limit = (limiter: RateLimiter, key: string) => {
		if (!limiter.attempt(key)) throw new AuthError('rate_limited');
	};

	function take(id: string, purpose: ChallengePurpose) {
		const c = challenges.take(id, purpose);
		if (!c) throw new AuthError('challenge_expired');
		return c;
	}

	async function registrationOptions(
		userId: string,
		userName: string,
		exclude: { id: string; transports: string[] }[]
	) {
		return generateRegistrationOptions({
			rpName: config.rpName,
			rpID: config.rpId,
			userID: uuidBytes(userId),
			userName,
			userDisplayName: userName,
			attestationType: 'none',
			excludeCredentials: exclude.map((c) => ({
				id: c.id,
				transports: c.transports as AuthenticatorTransportFuture[]
			})),
			authenticatorSelection: { residentKey: 'required', userVerification: 'required' }
		});
	}

	async function verifyRegistration(
		response: RegistrationResponseJSON,
		expectedChallenge: string,
		label: string
	): Promise<NewCredential> {
		const v = await verifyRegistrationResponse({
			response,
			expectedChallenge,
			expectedOrigin: config.origin,
			expectedRPID: config.rpId,
			requireUserVerification: true
		}).catch(() => undefined);
		if (!v?.verified) throw new AuthError('not_verified');
		const { credential, credentialDeviceType, credentialBackedUp } = v.registrationInfo;
		return {
			id: credential.id,
			publicKey: Buffer.from(credential.publicKey).toString('base64url'),
			counter: credential.counter,
			transports: credential.transports ?? [],
			deviceType: credentialDeviceType,
			backedUp: credentialBackedUp,
			label
		};
	}

	/** Verifies an assertion; returns the owner and new counter. */
	async function verifyAssertion(response: AuthenticationResponseJSON, expectedChallenge: string) {
		const stored = await store.findCredential(response.id);
		if (!stored) throw new AuthError('unknown_credential');
		// Discoverable credentials carry the user handle; it must match the credential's owner.
		const handle = response.response.userHandle;
		if (handle && bytesToUuid(Buffer.from(handle, 'base64url')) !== stored.userId) {
			throw new AuthError('not_verified');
		}
		const v = await verifyAuthenticationResponse({
			response,
			expectedChallenge,
			expectedOrigin: config.origin,
			expectedRPID: config.rpId,
			requireUserVerification: true,
			credential: {
				id: response.id,
				publicKey: Uint8Array.from(Buffer.from(stored.publicKey, 'base64url')),
				counter: stored.counter,
				transports: stored.transports as AuthenticatorTransportFuture[]
			}
		}).catch(() => undefined);
		if (!v?.verified) throw new AuthError('not_verified');
		return { userId: stored.userId, counter: v.authenticationInfo.newCounter };
	}

	function requireNormal(session: SessionRecord) {
		if (session.kind !== 'normal') throw new AuthError('forbidden');
	}

	function requireRecent(session: SessionRecord) {
		requireNormal(session);
		if (!recentlyVerified(session.verifiedAt, now())) throw new AuthError('recent_auth_required');
	}

	function requireAdmin(session: SessionRecord) {
		requireRecent(session);
		if (session.role !== 'admin') throw new AuthError('forbidden');
	}

	return {
		/** Resolves a session cookie; drops idle sessions and refreshes activity at most hourly. */
		async resolveSession(token: string | undefined): Promise<SessionRecord | undefined> {
			if (!token) return undefined;
			const session = await store.lookupSession(token);
			if (!session) return undefined;
			const at = now();
			if (!sessionUsable(session, at)) {
				await store.deleteSession(session.userId, session.sessionId);
				return undefined;
			}
			if (at.getTime() - session.lastSeenAt.getTime() > POLICY.sessionTouchIntervalMs) {
				await store.touchSession(session.userId, session.sessionId);
			}
			return session;
		},

		async signOut(session: SessionRecord) {
			await store.deleteSession(session.userId, session.sessionId);
		},

		// First admin --------------------------------------------------------------------------------------
		async setupOptions(token: string, displayName: string, clientIp: string) {
			limit(limits.enrolIp, clientIp);
			const name = cleanDisplayName(displayName);
			if (!name) throw new AuthError('not_verified');
			if (!(await store.setupAvailable(token))) throw new AuthError('setup_unavailable');
			const userId = randomUUID();
			const opts = await registrationOptions(userId, name, []);
			const challengeId = challenges.put({
				challenge: opts.challenge,
				purpose: 'setup',
				userId,
				tokenHash: hashToken(token),
				displayName: name
			});
			return { options: opts, challengeId };
		},

		async setupVerify(
			token: string,
			challengeId: string,
			response: RegistrationResponseJSON,
			label?: string
		) {
			const c = take(challengeId, 'setup');
			if (c.tokenHash !== hashToken(token)) throw new AuthError('setup_unavailable');
			const credential = await verifyRegistration(
				response,
				c.challenge,
				cleanLabel(label, 'Passkey')
			);
			return store.bootstrapAdmin(token, c.userId!, c.displayName!, credential);
		},

		// Invites ------------------------------------------------------------------------------------------
		async joinOptions(token: string, displayName: string, clientIp: string) {
			limit(limits.enrolIp, clientIp);
			const name = cleanDisplayName(displayName);
			if (!name) throw new AuthError('not_verified');
			if (!(await store.inviteAvailable(token))) throw new AuthError('invite_unavailable');
			const userId = randomUUID();
			const opts = await registrationOptions(userId, name, []);
			const challengeId = challenges.put({
				challenge: opts.challenge,
				purpose: 'join',
				userId,
				tokenHash: hashToken(token),
				displayName: name
			});
			return { options: opts, challengeId };
		},

		async joinVerify(
			token: string,
			challengeId: string,
			response: RegistrationResponseJSON,
			label?: string
		) {
			const c = take(challengeId, 'join');
			if (c.tokenHash !== hashToken(token)) throw new AuthError('invite_unavailable');
			const credential = await verifyRegistration(
				response,
				c.challenge,
				cleanLabel(label, 'Passkey')
			);
			return store.redeemInvite(token, c.userId!, c.displayName!, credential);
		},

		async createInvite(session: SessionRecord, note: string | null) {
			requireAdmin(session);
			const clean = note ? note.normalize('NFC').trim().slice(0, 60) || null : null;
			return store.createInvite(session.userId, clean);
		},

		async listInvites(session: SessionRecord) {
			requireNormal(session);
			if (session.role !== 'admin') throw new AuthError('forbidden');
			return store.listInvites(session.userId);
		},

		async revokeInvite(session: SessionRecord, inviteId: string) {
			requireAdmin(session);
			return store.revokeInvite(session.userId, inviteId);
		},

		// Sign-in and re-verification ------------------------------------------------------------------------
		async loginOptions(clientIp: string) {
			limit(limits.loginIp, clientIp);
			const opts = await generateAuthenticationOptions({
				rpID: config.rpId,
				userVerification: 'required'
			});
			return {
				options: opts,
				challengeId: challenges.put({ challenge: opts.challenge, purpose: 'login' })
			};
		},

		async loginVerify(challengeId: string, response: AuthenticationResponseJSON, clientIp: string) {
			limit(limits.loginIp, clientIp);
			limit(limits.loginAccount, response.id);
			const c = take(challengeId, 'login');
			const { userId, counter } = await verifyAssertion(response, c.challenge);
			return store.completeSignIn(userId, response.id, counter);
		},

		async reauthOptions(session: SessionRecord) {
			requireNormal(session);
			const creds = await store.credentialIds(session.userId);
			const opts = await generateAuthenticationOptions({
				rpID: config.rpId,
				userVerification: 'required',
				allowCredentials: creds.map((c) => ({
					id: c.id,
					transports: c.transports as AuthenticatorTransportFuture[]
				}))
			});
			const challengeId = challenges.put({
				challenge: opts.challenge,
				purpose: 'reauth',
				userId: session.userId
			});
			return { options: opts, challengeId };
		},

		async reauthVerify(
			session: SessionRecord,
			challengeId: string,
			response: AuthenticationResponseJSON
		) {
			requireNormal(session);
			const c = take(challengeId, 'reauth');
			if (c.userId !== session.userId) throw new AuthError('not_verified');
			const { userId, counter } = await verifyAssertion(response, c.challenge);
			if (userId !== session.userId) throw new AuthError('not_verified');
			await store.recordAssertion(userId, response.id, counter);
			await store.markVerified(userId, session.sessionId);
		},

		// Credential management -----------------------------------------------------------------------------
		async listCredentials(session: SessionRecord) {
			requireNormal(session);
			return store.listCredentials(session.userId);
		},

		async addCredentialOptions(session: SessionRecord) {
			requireRecent(session);
			const opts = await registrationOptions(
				session.userId,
				session.displayName,
				await store.credentialIds(session.userId)
			);
			const challengeId = challenges.put({
				challenge: opts.challenge,
				purpose: 'add-credential',
				userId: session.userId
			});
			return { options: opts, challengeId };
		},

		async addCredentialVerify(
			session: SessionRecord,
			challengeId: string,
			response: RegistrationResponseJSON,
			label?: string
		) {
			requireRecent(session);
			const c = take(challengeId, 'add-credential');
			if (c.userId !== session.userId) throw new AuthError('not_verified');
			const credential = await verifyRegistration(
				response,
				c.challenge,
				cleanLabel(label, 'Passkey')
			);
			await store.addCredential(session.userId, credential);
		},

		async removeCredential(session: SessionRecord, credentialId: string) {
			requireRecent(session);
			await store.removeCredential(session.userId, credentialId);
		},

		async recoveryCodeCount(session: SessionRecord) {
			requireNormal(session);
			return store.unusedRecoveryCodeCount(session.userId);
		},

		async regenerateRecoveryCodes(session: SessionRecord) {
			requireRecent(session);
			return store.replaceRecoveryCodes(session.userId);
		},

		async signOutOtherSessions(session: SessionRecord) {
			requireRecent(session);
			return store.signOutOtherSessions(session.userId, session.sessionId);
		},

		// Recovery -------------------------------------------------------------------------------------------
		/** Starts recovery with a recovery code or an operator link token; returns a recovery-session token. */
		async beginRecovery(input: { code?: string; linkToken?: string }, clientIp: string) {
			limit(limits.recoveryIp, clientIp);
			let token: string | undefined;
			if (input.code) {
				const normalized = normalizeRecoveryCode(input.code);
				token = normalized ? await store.beginRecoveryWithCode(normalized) : undefined;
			} else if (input.linkToken) {
				token = await store.beginRecoveryWithLink(input.linkToken);
			}
			if (!token) throw new AuthError('recovery_unavailable');
			return token;
		},

		async recoveryOptions(session: SessionRecord, recoveryToken: string) {
			if (session.kind !== 'recovery') throw new AuthError('forbidden');
			const opts = await registrationOptions(session.userId, session.displayName, []);
			const challengeId = challenges.put({
				challenge: opts.challenge,
				purpose: 'recovery',
				userId: session.userId,
				tokenHash: hashToken(recoveryToken)
			});
			return { options: opts, challengeId };
		},

		async recoveryVerify(
			session: SessionRecord,
			recoveryToken: string,
			challengeId: string,
			response: RegistrationResponseJSON,
			label?: string
		) {
			if (session.kind !== 'recovery') throw new AuthError('forbidden');
			const c = take(challengeId, 'recovery');
			if (c.userId !== session.userId || c.tokenHash !== hashToken(recoveryToken)) {
				throw new AuthError('not_verified');
			}
			const credential = await verifyRegistration(
				response,
				c.challenge,
				cleanLabel(label, 'Passkey')
			);
			return store.completeRecovery(recoveryToken, credential);
		}
	};
}

export type AuthService = ReturnType<typeof createAuthService>;
