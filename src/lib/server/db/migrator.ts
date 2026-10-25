// Applies migrations as the schema owner. docs/design.md ("Upgrades and rollback"): one runner protected by
// a database lock, and the pending batch plus its bookkeeping in a single transaction, so a failure leaves the
// previous schema and data intact.
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import type { Sql } from 'postgres';

export interface Migration {
	name: string;
	sql: string;
	checksum: string;
}

const BREAKPOINT = '--> statement-breakpoint';
// Statements that cannot run inside a transaction need a separately reviewed procedure.
const NON_TRANSACTIONAL =
	/\b(concurrently|vacuum|alter\s+system|create\s+database|drop\s+database)\b/i;

/** Loads migrations in the order recorded by drizzle-kit's journal. */
export async function loadMigrations(dir: string): Promise<Migration[]> {
	const journal = JSON.parse(await readFile(path.join(dir, 'meta', '_journal.json'), 'utf8')) as {
		entries: { idx: number; tag: string }[];
	};
	const entries = [...journal.entries].sort((a, b) => a.idx - b.idx);
	return Promise.all(
		entries.map(async ({ tag }) => {
			const sql = await readFile(path.join(dir, `${tag}.sql`), 'utf8');
			return { name: tag, sql, checksum: createHash('sha256').update(sql).digest('hex') };
		})
	);
}

export class MigrationError extends Error {}

/** Applies pending migrations and returns their names. Concurrent runners wait for each other. */
export async function migrate(sql: Sql, migrations: Migration[]): Promise<string[]> {
	for (const m of migrations) {
		if (NON_TRANSACTIONAL.test(m.sql)) {
			throw new MigrationError(`${m.name} contains a non-transactional statement`);
		}
	}
	return sql.begin(async (tx) => {
		await tx`select pg_advisory_xact_lock(hashtext('obur:migrations'))`;
		await tx`create table if not exists schema_migrations (
			name text primary key,
			checksum text not null,
			applied_at timestamptz not null default now()
		)`;
		const applied = await tx<{ name: string; checksum: string }[]>`
			select name, checksum from schema_migrations`;
		const known = new Map(migrations.map((m) => [m.name, m]));
		for (const row of applied) {
			const m = known.get(row.name);
			if (!m) throw new MigrationError(`Database has migration ${row.name} that this build lacks`);
			if (m.checksum !== row.checksum) {
				throw new MigrationError(`Applied migration ${row.name} was modified after it ran`);
			}
		}
		const done = new Set(applied.map((r) => r.name));
		const pending = migrations.filter((m) => !done.has(m.name));
		for (const m of pending) {
			for (const statement of m.sql.split(BREAKPOINT)) {
				if (statement.trim()) await tx.unsafe(statement).simple();
			}
			await tx`insert into schema_migrations (name, checksum) values (${m.name}, ${m.checksum})`;
		}
		return pending.map((m) => m.name);
	});
}
