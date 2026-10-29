import { sql } from 'drizzle-orm';
import {
	boolean,
	check,
	jsonb,
	pgTable,
	primaryKey,
	text,
	timestamp,
	uuid
} from 'drizzle-orm/pg-core';
import { users } from '../auth/index.ts';

// RLS policies, grants and the account-deletion function live in hand-written migrations under drizzle/.

// One row: this installation's identity, written into exports so a later import can tell which records came from
// here and which from another installation.
export const installation = pgTable(
	'installation',
	{
		singleton: boolean('singleton').primaryKey().default(true),
		id: uuid('id').notNull().defaultRandom(),
		createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow()
	},
	(t) => [check('installation_singleton', sql`${t.singleton}`)]
);

// Exact repeats of an uploaded archive, per person (file-level retry protection only; rows are matched through
// import_identities).
export const importFiles = pgTable(
	'import_files',
	{
		userId: uuid('user_id')
			.notNull()
			.references(() => users.id, { onDelete: 'cascade' }),
		sha256: text('sha256').notNull(),
		importedAt: timestamp('imported_at', { withTimezone: true }).notNull().defaultNow(),
		summary: jsonb('summary').notNull()
	},
	(t) => [
		primaryKey({ columns: [t.userId, t.sha256] }),
		check('import_files_sha256_hex', sql`${t.sha256} ~ '^[0-9a-f]{64}$'`)
	]
);

// Which local record a source record became, so importing an overlapping archive again finds it.
export const importIdentities = pgTable(
	'import_identities',
	{
		userId: uuid('user_id')
			.notNull()
			.references(() => users.id, { onDelete: 'cascade' }),
		sourceInstall: uuid('source_install').notNull(),
		kind: text('kind', {
			enum: ['food', 'diary', 'weight', 'water', 'activity', 'target']
		}).notNull(),
		sourceId: text('source_id').notNull(),
		localId: uuid('local_id').notNull()
	},
	(t) => [
		primaryKey({ columns: [t.userId, t.sourceInstall, t.kind, t.sourceId] }),
		check(
			'import_identities_kind_valid',
			sql`${t.kind} in ('food', 'diary', 'weight', 'water', 'activity', 'target')`
		),
		check('import_identities_source_id_length', sql`char_length(${t.sourceId}) between 1 and 100`)
	]
);

// Deleted accounts: an opaque ID and the date only (docs/design.md, "Deletion and retained copies"). Used to
// reapply deletions after a restore; never holds diary content.
export const accountDeletions = pgTable(
	'account_deletions',
	{
		accountId: uuid('account_id').primaryKey(),
		deletedAt: timestamp('deleted_at', { withTimezone: true }).notNull().defaultNow(),
		by: text('by', { enum: ['self', 'admin'] }).notNull(),
		// Whether shared foods were removed too, so a restore can reapply the deletion exactly.
		removedSharedFoods: boolean('removed_shared_foods').notNull().default(false)
	},
	(t) => [check('account_deletions_by_valid', sql`${t.by} in ('self', 'admin')`)]
);
