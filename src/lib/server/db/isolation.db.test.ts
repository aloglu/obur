// Row-level security and role tests against real PostgreSQL, run as the actual runtime roles
// (CLAUDE.md: test cross-user reads and writes, missing identity and connection reuse).
import { randomUUID } from 'node:crypto';
import { eq, sql } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { afterAll, beforeEach, describe, expect, inject, it } from 'vitest';
import { users } from '#lib/server/modules/auth/index.ts';
import { ROLES } from './bootstrap.ts';
import { IdentityError, withUser } from './identity.ts';

const urls = inject('db');
const admin = postgres(urls.admin, { max: 1, onnotice: () => {} });
// One connection per runtime role, so every test also exercises connection reuse.
const appSql = postgres(urls.app, { max: 1, onnotice: () => {} });
const workerSql = postgres(urls.worker, { max: 1, onnotice: () => {} });
const app = drizzle(appSql);
const worker = drizzle(workerSql);

const alice = randomUUID();
const bob = randomUUID();

/** Postgres error code from a postgres.js or Drizzle-wrapped error. */
async function errorCode(promise: Promise<unknown>): Promise<string | undefined> {
	try {
		await promise;
	} catch (e) {
		const err = e as { code?: string; cause?: { code?: string } };
		return err.cause?.code ?? err.code;
	}
	return undefined;
}

beforeEach(async () => {
	await admin`truncate users`;
	await admin`insert into users (id, display_name) values (${alice}, 'Alice'), (${bob}, 'Bob')`;
});

afterAll(async () => {
	await Promise.all([admin.end(), appSql.end(), workerSql.end()]);
});

describe('runtime roles', () => {
	it.each([ROLES.app, ROLES.worker])(
		'%s is not a superuser and cannot bypass RLS',
		async (role) => {
			const [r] = await admin`
			select rolsuper, rolbypassrls, rolinherit, rolcreaterole, rolcreatedb,
				pg_has_role(${role}, ${ROLES.migrator}, 'MEMBER') as is_migrator
			from pg_roles where rolname = ${role}`;
			expect(r).toEqual({
				rolsuper: false,
				rolbypassrls: false,
				rolinherit: false,
				rolcreaterole: false,
				rolcreatedb: false,
				is_migrator: false
			});
		}
	);

	it.each([ROLES.app, ROLES.worker])('%s owns no tables or functions', async (role) => {
		const owned = await admin`
			select c.relname from pg_class c join pg_roles r on r.oid = c.relowner where r.rolname = ${role}
			union all
			select p.proname from pg_proc p join pg_roles r on r.oid = p.proowner where r.rolname = ${role}`;
		expect(owned).toEqual([]);
	});

	it('every application table enables and forces row-level security', async () => {
		const tables = await admin`
			select c.relname, c.relrowsecurity, c.relforcerowsecurity
			from pg_class c join pg_namespace n on n.oid = c.relnamespace
			where n.nspname = 'public' and c.relkind = 'r' and c.relname <> 'schema_migrations'`;
		expect(tables.length).toBeGreaterThan(0);
		for (const t of tables) {
			expect({ table: t.relname, rls: t.relrowsecurity, forced: t.relforcerowsecurity }).toEqual({
				table: t.relname,
				rls: true,
				forced: true
			});
		}
	});

	it('runtime roles have no access to migration bookkeeping', async () => {
		expect(await errorCode(appSql`select * from schema_migrations`)).toBe('42501');
		expect(await errorCode(workerSql`select * from schema_migrations`)).toBe('42501');
	});

	it('the app role cannot disable RLS, assume the owner role or create tables', async () => {
		expect(await errorCode(appSql`alter table users disable row level security`)).toBe('42501');
		expect(await errorCode(appSql.unsafe(`set role ${ROLES.migrator}`))).toBe('42501');
		expect(await errorCode(appSql`create table sneaky (id int)`)).toBe('42501');
	});
});

describe('withUser isolation', () => {
	it('reads only the signed-in user’s row', async () => {
		const rows = await withUser(app, alice, (tx) => tx.select().from(users));
		expect(rows.map((r) => r.id)).toEqual([alice]);
	});

	it('cannot update another user’s row', async () => {
		const changed = await withUser(app, alice, (tx) =>
			tx.update(users).set({ displayName: 'Hacked' }).where(eq(users.id, bob)).returning()
		);
		expect(changed).toEqual([]);
		const [row] = await admin`select display_name from users where id = ${bob}`;
		expect(row.display_name).toBe('Bob');
	});

	it('can update its own display name but not its own role', async () => {
		const changed = await withUser(app, alice, (tx) =>
			tx.update(users).set({ displayName: 'Alice A.' }).where(eq(users.id, alice)).returning()
		);
		expect(changed.map((r) => r.displayName)).toEqual(['Alice A.']);
		const escalate = withUser(app, alice, (tx) =>
			tx.update(users).set({ role: 'admin' }).where(eq(users.id, alice))
		);
		expect(await errorCode(escalate)).toBe('42501');
	});

	it('cannot insert a row for another identity', async () => {
		const insert = withUser(app, alice, (tx) =>
			tx.insert(users).values({ id: randomUUID(), displayName: 'Mallory' })
		);
		expect(await errorCode(insert)).toBe('42501');
	});

	it('can insert the row for its own identity (enrolment)', async () => {
		const carol = randomUUID();
		await withUser(app, carol, (tx) =>
			tx.insert(users).values({ id: carol, displayName: 'Carol' })
		);
		const [row] = await admin`select display_name, role from users where id = ${carol}`;
		expect(row).toEqual({ display_name: 'Carol', role: 'member' });
	});

	it('cannot create its own row as an admin or as disabled', async () => {
		const dave = randomUUID();
		const asAdmin = withUser(app, dave, (tx) =>
			tx.insert(users).values({ id: dave, displayName: 'Dave', role: 'admin' })
		);
		expect(await errorCode(asAdmin)).toBe('42501');
		const disabled = withUser(app, dave, (tx) =>
			tx.insert(users).values({ id: dave, displayName: 'Dave', disabledAt: new Date() })
		);
		expect(await errorCode(disabled)).toBe('42501');
	});

	it('cannot delete user rows', async () => {
		const del = withUser(app, alice, (tx) => tx.delete(users).where(eq(users.id, alice)));
		expect(await errorCode(del)).toBe('42501');
	});

	it('the worker role is isolated the same way and cannot write users', async () => {
		const rows = await withUser(worker, bob, (tx) => tx.select().from(users));
		expect(rows.map((r) => r.id)).toEqual([bob]);
		const insert = withUser(worker, bob, (tx) =>
			tx.insert(users).values({ id: bob, displayName: 'Bob again' })
		);
		expect(await errorCode(insert)).toBe('42501');
	});
});

describe('missing or malformed identity fails closed', () => {
	it('sees nothing and cannot write without an identity', async () => {
		expect(await app.select().from(users)).toEqual([]);
		expect(await errorCode(app.insert(users).values({ id: alice, displayName: 'X' }))).toBe(
			'42501'
		);
	});

	it('rejects a malformed identity before any query runs', async () => {
		await expect(withUser(app, 'not-a-uuid', async () => 'ran')).rejects.toBeInstanceOf(
			IdentityError
		);
		await expect(withUser(app, '', async () => 'ran')).rejects.toBeInstanceOf(IdentityError);
	});

	it('errors rather than matching rows if a malformed identity reaches the database', async () => {
		const code = await errorCode(
			app.transaction(async (tx) => {
				await tx.execute(sql`select set_config('app.user_id', 'garbage', true)`);
				return tx.select().from(users);
			})
		);
		expect(code).toBe('22P02');
	});
});

describe('connection reuse', () => {
	it('does not carry an identity past its transaction', async () => {
		await withUser(app, alice, (tx) => tx.select().from(users));
		expect(await app.select().from(users)).toEqual([]);
	});

	it('does not leak an identity after a failed transaction', async () => {
		await expect(
			withUser(app, alice, async (tx) => {
				await tx.select().from(users);
				throw new Error('boom');
			})
		).rejects.toThrow('boom');
		expect(await app.select().from(users)).toEqual([]);
		const rows = await withUser(app, bob, (tx) => tx.select().from(users));
		expect(rows.map((r) => r.id)).toEqual([bob]);
	});

	it('keeps concurrent users apart on a shared pool', async () => {
		const pool = drizzle(postgres(urls.app, { max: 2, onnotice: () => {} }));
		const results = await Promise.all(
			Array.from({ length: 20 }, (_, i) => {
				const id = i % 2 ? alice : bob;
				return withUser(pool, id, async (tx) => ({
					id,
					seen: (await tx.select().from(users)).map((r) => r.id)
				}));
			})
		);
		for (const r of results) expect(r.seen).toEqual([r.id]);
		await pool.$client.end();
	});
});
