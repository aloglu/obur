// High-entropy tokens and recovery codes. Only SHA-256 hashes are stored (docs/design.md, "Passkeys and recovery").
import { createHash, randomBytes, randomInt } from 'node:crypto';

/** 256-bit URL-safe token for sessions, invites, setup and recovery links. */
export function newToken(): string {
	return randomBytes(32).toString('base64url');
}

export function hashToken(token: string): string {
	return createHash('sha256').update(token, 'utf8').digest('hex');
}

// Crockford base32: no I, L, O or U, so codes are easy to read aloud and type.
const ALPHABET = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';
const GROUPS = 4;
const GROUP_LENGTH = 4;

/** Codes like "7K2M-9QXD-4HBT-JW8R" (80 bits each). */
export function newRecoveryCodes(count = 10): string[] {
	return Array.from({ length: count }, () =>
		Array.from({ length: GROUPS }, () =>
			Array.from({ length: GROUP_LENGTH }, () => ALPHABET[randomInt(ALPHABET.length)]).join('')
		).join('-')
	);
}

/** Accepts lower case, spaces and the usual look-alikes (O→0, I/L→1). Returns undefined if not a code. */
export function normalizeRecoveryCode(input: string): string | undefined {
	const cleaned = input
		.toUpperCase()
		.replace(/[\s-]/g, '')
		.replace(/O/g, '0')
		.replace(/[IL]/g, '1');
	if (cleaned.length !== GROUPS * GROUP_LENGTH || [...cleaned].some((c) => !ALPHABET.includes(c))) {
		return undefined;
	}
	return cleaned;
}

export function hashRecoveryCode(normalized: string): string {
	return hashToken(`recovery:${normalized}`);
}
