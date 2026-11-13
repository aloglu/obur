import { randomUUID } from 'node:crypto';
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { afterAll, beforeEach, describe, expect, inject, it } from 'vitest';
import { createUpdates } from './service.ts';

const urls = inject('db');
const quiet = { onnotice: () => {} };
const admin = postgres(urls.admin, { max: 1, ...quiet });
const appSql = postgres(urls.app, { max: 2, ...quiet });
const app = drizzle(appSql);

const ADMIN = randomUUID();
const MEMBER = randomUUID();

let clock = new Date('2026-11-13T08:00:00Z');
let asked = 0;
let answer: string[] | Error = [];
const updates = () =>
	createUpdates(app, {
		current: '1.0.0',
		now: () => clock,
		published: async () => {
			asked += 1;
			if (answer instanceof Error) throw answer;
			return answer;
		}
	});
const hours = (n: number) => (clock = new Date(clock.getTime() + n * 3600_000));

beforeEach(async () => {
	await admin`truncate users cascade`;
	await admin`update household_settings set update_check = false, latest_version = null, latest_checked_at = null`;
	await admin`insert into users (id, display_name, role) values (${ADMIN}, 'Admin', 'admin'), (${MEMBER}, 'Member', 'member')`;
	clock = new Date('2026-11-13T08:00:00Z');
	asked = 0;
	answer = ['v1.0.0', 'v1.0.1', 'v1.1.0-beta.1'];
});
afterAll(async () => {
	await admin.end();
	await appSql.end();
});

describe('the check for new versions', () => {
	it('asks nobody until an admin turns it on', async () => {
		const u = updates();
		expect(await u.status(ADMIN, true)).toEqual({
			current: '1.0.0',
			check: false,
			latest: null,
			checkedAt: null
		});
		expect(asked).toBe(0);
	});

	it('asks at once when turned on, then once a day, and forgets when turned off', async () => {
		const u = updates();
		expect(await u.setCheck(ADMIN, true)).toMatchObject({ check: true, latest: '1.0.1' });
		expect(asked).toBe(1);
		hours(23);
		expect((await u.status(ADMIN, true)).latest).toBe('1.0.1');
		expect(asked).toBe(1);
		hours(2);
		answer = ['v1.0.2'];
		expect((await u.status(ADMIN, true)).latest).toBe('1.0.2');
		expect(asked).toBe(2);
		expect(await u.setCheck(ADMIN, false)).toMatchObject({
			check: false,
			latest: null,
			checkedAt: null
		});
		hours(48);
		await u.status(ADMIN, true);
		expect(asked).toBe(2);
	});

	it('says nothing once this installation runs the stored version', async () => {
		await updates().setCheck(ADMIN, true);
		const updated = createUpdates(app, {
			current: '1.0.1',
			now: () => clock,
			published: async () => []
		});
		expect((await updated.status(ADMIN, true)).latest).toBeNull();
	});

	it('keeps the last answer when GitHub cannot be reached, and waits before trying again', async () => {
		const u = updates();
		await u.setCheck(ADMIN, true);
		hours(25);
		answer = new Error('unreachable');
		expect(await u.status(ADMIN, true)).toMatchObject({ check: true, latest: '1.0.1' });
		expect(asked).toBe(2);
		await u.status(ADMIN, true);
		expect(asked).toBe(2);
		hours(2);
		answer = ['v1.0.3'];
		expect((await u.status(ADMIN, true)).latest).toBe('1.0.3');
	});

	it('is the admins’ alone: a member can neither switch it nor cause a request', async () => {
		const u = updates();
		expect(await u.setCheck(MEMBER, true)).toBeNull();
		expect(asked).toBe(0);
		await u.setCheck(ADMIN, true);
		expect(await u.status(MEMBER, false)).toMatchObject({ check: false, latest: null });
		// Even a member claiming to be an admin cannot store an answer: the database refuses the write.
		hours(25);
		answer = ['v9.9.9'];
		await u.status(MEMBER, true);
		const [stored] = await admin`select latest_version from household_settings`;
		expect(stored.latest_version).toBe('1.0.1');
		expect(await u.setCheck(MEMBER, false)).toBeNull();
		expect((await u.status(ADMIN, true)).check).toBe(true);
	});
});
