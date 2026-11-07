// Keys at rest: AES-256-GCM under the server's own key (OBUR_SECRETS_KEY, 32 bytes as 64 hex characters), which
// lives in /data/secrets and never in backups. A key encrypted on another server can't be read here: decrypt says so
// and the person enters it again.
import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';

const VERSION = 'v1';

export function parseSecretsKey(hex: string): Buffer {
	if (!/^[0-9a-f]{64}$/i.test(hex)) throw new Error('OBUR_SECRETS_KEY must be 64 hex characters');
	return Buffer.from(hex, 'hex');
}

/** The user id is bound in as associated data, so a row copied to another person can't be decrypted. */
export function encryptKey(secret: Buffer, userId: string, plaintext: string): string {
	const iv = randomBytes(12);
	const cipher = createCipheriv('aes-256-gcm', secret, iv);
	cipher.setAAD(Buffer.from(userId));
	const body = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
	return `${VERSION}:${Buffer.concat([iv, cipher.getAuthTag(), body]).toString('base64')}`;
}

/** The key, or null when it can't be read with this server's key. */
export function decryptKey(secret: Buffer, userId: string, stored: string): string | null {
	const [version, data] = stored.split(':');
	if (version !== VERSION || !data) return null;
	try {
		const raw = Buffer.from(data, 'base64');
		const decipher = createDecipheriv('aes-256-gcm', secret, raw.subarray(0, 12));
		decipher.setAAD(Buffer.from(userId));
		decipher.setAuthTag(raw.subarray(12, 28));
		return Buffer.concat([decipher.update(raw.subarray(28)), decipher.final()]).toString('utf8');
	} catch {
		return null;
	}
}
