import { randomBytes, randomUUID } from 'node:crypto';
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { afterAll, beforeEach, describe, expect, inject, it } from 'vitest';
import { withUser } from '../../db/identity.ts';
import { decryptKey, encryptKey } from './crypto.ts';
import { modelKeys } from './schema.ts';
import { ModelChoiceError, createRemoteModels } from './service.ts';

const urls = inject('db');
const quiet = { onnotice: () => {} };
const admin = postgres(urls.admin, { max: 1, ...quiet });
const appSql = postgres(urls.app, { max: 2, ...quiet });
const app = drizzle(appSql);
const secret = randomBytes(32);
const models = createRemoteModels(app, secret);

const ADMIN = randomUUID();
const MEMBER = randomUUID();
const KEY = 'sk-test-0123456789abcdefWXYZ';

beforeEach(async () => {
	await admin`truncate users cascade`;
	await admin`update household_settings set personal_keys = true`;
	await admin`insert into users (id, display_name, role) values (${ADMIN}, 'Admin', 'admin'), (${MEMBER}, 'Member', 'member')`;
});
afterAll(async () => {
	await admin.end();
	await appSql.end();
});

describe('keys', () => {
	it('are stored encrypted, shown by their last four characters, and read back only by their owner', async () => {
		await models.saveKey(MEMBER, 'openai', KEY);
		const [row] = await admin`select ciphertext, last4 from model_keys where user_id = ${MEMBER}`;
		expect(row.ciphertext).not.toContain(KEY);
		expect(row.last4).toBe('WXYZ');
		expect(await models.keys(MEMBER)).toMatchObject([
			{ provider: 'openai', last4: 'WXYZ', unreadable: false }
		]);
		expect(await models.keyFor(MEMBER, 'openai')).toBe(KEY);
		// Nobody else reaches the row, an admin included.
		expect(await models.keys(ADMIN)).toEqual([]);
		expect(await models.keyFor(ADMIN, 'openai')).toBeNull();
		const seen = await withUser(app, ADMIN, (tx) => tx.select().from(modelKeys));
		expect(seen).toEqual([]);
	});

	it('cannot be written for someone else', async () => {
		await expect(
			withUser(app, ADMIN, (tx) =>
				tx.insert(modelKeys).values({
					userId: MEMBER,
					provider: 'openai',
					ciphertext: encryptKey(secret, MEMBER, KEY),
					last4: 'WXYZ',
					checkedAt: new Date()
				})
			)
		).rejects.toThrow();
	});

	it('read as unreadable on a server with another secrets key, or when moved to another person', async () => {
		await models.saveKey(MEMBER, 'openai', KEY);
		const elsewhere = createRemoteModels(app, randomBytes(32));
		expect(await elsewhere.keys(MEMBER)).toMatchObject([{ provider: 'openai', unreadable: true }]);
		expect(await elsewhere.keyFor(MEMBER, 'openai')).toBeNull();
		const stored = encryptKey(secret, MEMBER, KEY);
		expect(decryptKey(secret, ADMIN, stored)).toBeNull();
		expect(decryptKey(secret, MEMBER, stored)).toBe(KEY);
	});

	it('removing one puts whatever used it back on the server', async () => {
		await models.saveKey(MEMBER, 'openrouter', KEY);
		await models.choose(MEMBER, 'speak', 'openrouter', true);
		await models.choose(MEMBER, 'scan', 'openrouter', true);
		await models.removeKey(MEMBER, 'openrouter');
		expect(await models.keys(MEMBER)).toEqual([]);
		expect(await models.choices(MEMBER)).toEqual({ speak: 'server', scan: 'server' });
	});
});

describe('choosing a provider', () => {
	it('needs agreement, a key and the household’s permission, and records when it was allowed', async () => {
		await expect(models.choose(MEMBER, 'speak', 'openai', true)).rejects.toThrow(ModelChoiceError);
		await models.saveKey(MEMBER, 'openai', KEY);
		await expect(models.choose(MEMBER, 'speak', 'openai', false)).rejects.toThrow(ModelChoiceError);
		expect(await models.choose(MEMBER, 'speak', 'openai', true)).toEqual({
			speak: 'openai',
			scan: 'server'
		});
		const [row] =
			await admin`select speak_allowed_at, scan_allowed_at from model_choices where user_id = ${MEMBER}`;
		expect(row.speak_allowed_at).toBeInstanceOf(Date);
		expect(row.scan_allowed_at).toBeNull();
		// Back to the server needs nothing.
		expect(await models.choose(MEMBER, 'speak', 'server', false)).toEqual({
			speak: 'server',
			scan: 'server'
		});
	});

	it('the database refuses a provider without the date it was allowed', async () => {
		await expect(
			admin`insert into model_choices (user_id, speak) values (${MEMBER}, 'openai')`
		).rejects.toThrow(/model_choices_allowed/);
	});

	it('is refused while the household has personal keys off, and without a secrets key', async () => {
		await models.saveKey(MEMBER, 'openai', KEY);
		await admin`update household_settings set personal_keys = false`;
		expect(await models.allowed(MEMBER)).toBe(false);
		await expect(models.choose(MEMBER, 'scan', 'openai', true)).rejects.toThrow(ModelChoiceError);
		expect(await createRemoteModels(app, null).allowed(MEMBER)).toBe(false);
	});
});

describe('the household switch', () => {
	it('only an admin can change it; everyone can read it', async () => {
		expect(await models.setHouseholdAllows(MEMBER, false)).toBe(false);
		expect(await models.householdAllows(MEMBER)).toBe(true);
		expect(await models.setHouseholdAllows(ADMIN, false)).toBe(true);
		expect(await models.householdAllows(MEMBER)).toBe(false);
	});
});

describe('usage', () => {
	it('counts per month, provider and feature, for its owner only', async () => {
		const nov = new Date('2026-11-07T12:00:00Z');
		await models.countUse(MEMBER, 'openai', 'speak', nov);
		await models.countUse(MEMBER, 'openai', 'speak', nov);
		await models.countUse(MEMBER, 'openai', 'scan', nov);
		await models.countUse(MEMBER, 'openai', 'speak', new Date('2026-10-30T12:00:00Z'));
		expect(await models.usage(MEMBER, nov)).toEqual({ openai: { speak: 2, scan: 1 } });
		expect(await models.usage(ADMIN, nov)).toEqual({});
	});
});
