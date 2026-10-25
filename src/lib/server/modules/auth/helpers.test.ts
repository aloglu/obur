import { describe, expect, it } from 'vitest';
import { ChallengeStore } from './challenges.ts';
import { POLICY, recentlyVerified, sessionUsable } from './policy.ts';
import { RateLimiter } from './rate-limit.ts';
import {
	hashRecoveryCode,
	hashToken,
	newRecoveryCodes,
	newToken,
	normalizeRecoveryCode
} from './tokens.ts';

describe('tokens', () => {
	it('creates distinct 256-bit URL-safe tokens and stable hashes', () => {
		const a = newToken();
		expect(a).toMatch(/^[A-Za-z0-9_-]{43}$/);
		expect(newToken()).not.toBe(a);
		expect(hashToken(a)).toBe(hashToken(a));
		expect(hashToken(a)).toMatch(/^[0-9a-f]{64}$/);
	});

	it('creates readable recovery codes that survive typical typing variations', () => {
		const codes = newRecoveryCodes();
		expect(codes).toHaveLength(10);
		expect(new Set(codes).size).toBe(10);
		for (const code of codes) {
			expect(code).toMatch(/^[0-9A-HJKMNP-TV-Z]{4}(-[0-9A-HJKMNP-TV-Z]{4}){3}$/);
			const typed = ` ${code.toLowerCase().replace(/-/g, ' ')} `;
			expect(normalizeRecoveryCode(typed)).toBe(code.replace(/-/g, ''));
		}
	});

	it('maps look-alike letters and rejects malformed codes', () => {
		expect(normalizeRecoveryCode('O1IL-0000-0000-0000')).toBe('0111000000000000');
		expect(normalizeRecoveryCode('ABCD-EFGH-JKMN-PQR')).toBeUndefined();
		expect(normalizeRecoveryCode('ABCD-EFGH-JKMN-PQRU')).toBeUndefined();
		expect(normalizeRecoveryCode('')).toBeUndefined();
	});

	it('separates recovery-code hashes from token hashes', () => {
		expect(hashRecoveryCode('0000000000000000')).not.toBe(hashToken('0000000000000000'));
	});
});

describe('session policy', () => {
	const now = new Date('2026-10-25T12:00:00Z');
	const ago = (ms: number) => new Date(now.getTime() - ms);
	const ahead = (ms: number) => new Date(now.getTime() + ms);

	it('expires at the absolute limit even when active', () => {
		expect(sessionUsable({ lastSeenAt: now, expiresAt: ahead(1) }, now)).toBe(true);
		expect(sessionUsable({ lastSeenAt: now, expiresAt: now }, now)).toBe(false);
	});

	it('expires after the idle window', () => {
		const expiresAt = ahead(POLICY.sessionAbsoluteMs);
		expect(sessionUsable({ lastSeenAt: ago(POLICY.sessionIdleMs - 1), expiresAt }, now)).toBe(true);
		expect(sessionUsable({ lastSeenAt: ago(POLICY.sessionIdleMs), expiresAt }, now)).toBe(false);
	});

	it('treats a passkey check as recent only within the window', () => {
		expect(recentlyVerified(ago(POLICY.recentAuthMs - 1), now)).toBe(true);
		expect(recentlyVerified(ago(POLICY.recentAuthMs), now)).toBe(false);
	});
});

describe('ChallengeStore', () => {
	it('returns a challenge once, only for its purpose', () => {
		const store = new ChallengeStore();
		const id = store.put({ challenge: 'c1', purpose: 'login' });
		expect(store.take(id, 'setup')).toBeUndefined();
		const id2 = store.put({ challenge: 'c2', purpose: 'login', userId: 'u' });
		expect(store.take(id2, 'login')).toEqual({ challenge: 'c2', purpose: 'login', userId: 'u' });
		expect(store.take(id2, 'login')).toBeUndefined();
	});

	it('expires challenges', () => {
		let t = 0;
		const store = new ChallengeStore(10, () => t);
		const id = store.put({ challenge: 'c', purpose: 'login' });
		t = POLICY.challengeMs;
		expect(store.take(id, 'login')).toBeUndefined();
	});

	it('stays bounded by dropping the oldest entry', () => {
		const store = new ChallengeStore(2);
		const first = store.put({ challenge: 'a', purpose: 'login' });
		store.put({ challenge: 'b', purpose: 'login' });
		const third = store.put({ challenge: 'c', purpose: 'login' });
		expect(store.take(first, 'login')).toBeUndefined();
		expect(store.take(third, 'login')?.challenge).toBe('c');
	});
});

describe('RateLimiter', () => {
	it('allows up to the limit per key and window, then resets', () => {
		let t = 0;
		const limiter = new RateLimiter(2, 1000, 100, () => t);
		expect([limiter.attempt('ip'), limiter.attempt('ip'), limiter.attempt('ip')]).toEqual([
			true,
			true,
			false
		]);
		expect(limiter.attempt('other')).toBe(true);
		t = 1000;
		expect(limiter.attempt('ip')).toBe(true);
	});

	it('stays bounded under many keys', () => {
		const limiter = new RateLimiter(1, 60_000, 3);
		for (let i = 0; i < 10; i++) limiter.attempt(`k${i}`);
		expect(limiter.attempt('k9')).toBe(false);
	});
});
