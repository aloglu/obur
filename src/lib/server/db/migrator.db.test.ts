// Migration runner behaviour against real PostgreSQL: atomic batches, locking and tamper detection.
import { createHash } from 'node:crypto';
import path from 'node:path';
import postgres from 'postgres';
import { afterAll, beforeAll, describe, expect, inject, it } from 'vitest';
import { bootstrapDatabase, passwordFromUrl } from './bootstrap.ts';
import { loadMigrations, migrate, MigrationError, type Migration } from './migrator.ts';

const urls = inject('db');
const scratch = `${urls.database}_migrator`;
const at = (url: string) => Object.assign(new URL(url), { pathname: `/${scratch}` }).toString();
const server = postgres(urls.admin, { max: 1, onnotice: () => {} });
const opened: postgres.Sql[] = [];
const connect = () => {
	const sql = postgres(at(urls.migrator), { max: 1, onnotice: () => {} });
	opened.push(sql);
	return sql;
};

const migration = (name: string, sql: string): Migration => ({
	name,
	sql,
	checksum: createHash('sha256').update(sql).digest('hex')
});

async function freshDatabase() {
	await server.unsafe(`drop database if exists ${scratch} with (force)`);
	await server.unsafe(`create database ${scratch}`);
	const admin = postgres(at(urls.admin), { max: 1, onnotice: () => {} });
	await bootstrapDatabase(admin, scratch, {
		migrator: passwordFromUrl(urls.migrator),
		app: passwordFromUrl(urls.app),
		worker: passwordFromUrl(urls.worker)
	});
	await admin.end();
}

const exists = async (sql: postgres.Sql, table: string) =>
	(await sql`select to_regclass(${table}) is not null as e`)[0].e as boolean;

beforeAll(freshDatabase);
afterAll(async () => {
	await Promise.all(opened.map((s) => s.end()));
	await server.unsafe(`drop database if exists ${scratch} with (force)`);
	await server.end();
});

describe('migrate', () => {
	it('loads the repository migrations in journal order', async () => {
		const all = await loadMigrations(path.resolve(import.meta.dirname, '../../../../drizzle'));
		expect(all.slice(0, 2).map((m) => m.name)).toEqual(['0000_users', '0001_users_rls']);
	});

	it('rolls back the whole batch when one migration fails', async () => {
		await freshDatabase();
		const sql = connect();
		const batch = [
			migration('0000_ok', 'create table first_table (id int)'),
			migration('0001_bad', 'create table second_table (id int);\nselect * from missing_table')
		];
		await expect(migrate(sql, batch)).rejects.toThrow();
		expect(await exists(sql, 'first_table')).toBe(false);
		expect(await exists(sql, 'second_table')).toBe(false);
		expect(await exists(sql, 'schema_migrations')).toBe(false);
	});

	it('lets concurrent runners apply each migration exactly once', async () => {
		await freshDatabase();
		const batch = [
			migration('0000_a', 'create table a (id int)'),
			migration('0001_b', 'create table b (id int)')
		];
		const results = await Promise.all([migrate(connect(), batch), migrate(connect(), batch)]);
		expect(results.map((r) => r.length).sort()).toEqual([0, 2]);
		const rows = await connect()`select name from schema_migrations order by name`;
		expect(rows.map((r) => r.name)).toEqual(['0000_a', '0001_b']);
	});

	it('refuses to run when an applied migration was modified', async () => {
		await freshDatabase();
		const sql = connect();
		await migrate(sql, [migration('0000_a', 'create table a (id int)')]);
		await expect(
			migrate(sql, [migration('0000_a', 'create table a (id bigint)')])
		).rejects.toBeInstanceOf(MigrationError);
	});

	it('refuses to run when the database is newer than this build', async () => {
		await freshDatabase();
		const sql = connect();
		await migrate(sql, [
			migration('0000_a', 'create table a (id int)'),
			migration('0001_b', 'create table b (id int)')
		]);
		await expect(
			migrate(sql, [migration('0000_a', 'create table a (id int)')])
		).rejects.toBeInstanceOf(MigrationError);
	});

	it('rejects statements that cannot run inside a transaction before touching the database', async () => {
		await freshDatabase();
		const sql = connect();
		await expect(
			migrate(sql, [migration('0000_idx', 'create index concurrently i on users (id)')])
		).rejects.toBeInstanceOf(MigrationError);
		expect(await exists(sql, 'schema_migrations')).toBe(false);
	});
});

describe('bootstrap', () => {
	it('takes the schema owner away from the runtime roles, and starts without warnings', async () => {
		const notices: string[] = [];
		const admin = postgres(at(urls.admin), {
			max: 1,
			onnotice: (n) => notices.push(String(n.message))
		});
		const member = async (role: string) =>
			(
				await admin`select exists(select 1 from pg_auth_members m
					join pg_roles r on r.oid = m.roleid join pg_roles u on u.oid = m.member
					where r.rolname = 'obur_migrator' and u.rolname = ${role}) as m`
			)[0].m as boolean;
		const passwords = {
			migrator: passwordFromUrl(urls.migrator),
			app: passwordFromUrl(urls.app),
			worker: passwordFromUrl(urls.worker)
		};
		try {
			// A membership granted by mistake is removed…
			await admin.unsafe('grant obur_migrator to obur_app');
			expect(await member('obur_app')).toBe(true);
			await bootstrapDatabase(admin, scratch, passwords);
			expect(await member('obur_app')).toBe(false);
			// …and an ordinary start, with nothing to remove, warns about nothing.
			notices.length = 0;
			await bootstrapDatabase(admin, scratch, passwords);
			expect(notices.filter((n) => /granted membership/.test(n))).toEqual([]);
		} finally {
			await admin.end();
		}
	});
});
