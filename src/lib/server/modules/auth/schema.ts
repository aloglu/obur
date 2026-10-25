import { sql } from 'drizzle-orm';
import { bigint, boolean, check, index, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core';

// Row-level security, policies, grants and the reviewed SECURITY DEFINER functions for these tables live in
// hand-written migrations under drizzle/. Tokens and codes are stored only as SHA-256 hashes (hex).

const createdAt = () => timestamp('created_at', { withTimezone: true }).notNull().defaultNow();

export const users = pgTable(
	'users',
	{
		id: uuid('id').primaryKey(),
		displayName: text('display_name').notNull(),
		role: text('role', { enum: ['admin', 'member'] })
			.notNull()
			.default('member'),
		createdAt: createdAt(),
		disabledAt: timestamp('disabled_at', { withTimezone: true })
	},
	(t) => [
		check('users_role_valid', sql`${t.role} in ('admin', 'member')`),
		check('users_display_name_length', sql`char_length(${t.displayName}) between 1 and 80`)
	]
);

export const credentials = pgTable(
	'credentials',
	{
		// WebAuthn credential ID, base64url.
		id: text('id').primaryKey(),
		userId: uuid('user_id')
			.notNull()
			.references(() => users.id, { onDelete: 'cascade' }),
		publicKey: text('public_key').notNull(),
		counter: bigint('counter', { mode: 'number' }).notNull().default(0),
		transports: text('transports')
			.array()
			.notNull()
			.default(sql`'{}'`),
		deviceType: text('device_type', { enum: ['singleDevice', 'multiDevice'] }).notNull(),
		backedUp: boolean('backed_up').notNull(),
		label: text('label').notNull(),
		createdAt: createdAt(),
		lastUsedAt: timestamp('last_used_at', { withTimezone: true })
	},
	(t) => [
		check('credentials_device_type_valid', sql`${t.deviceType} in ('singleDevice', 'multiDevice')`),
		check('credentials_label_length', sql`char_length(${t.label}) between 1 and 40`),
		check('credentials_counter_non_negative', sql`${t.counter} >= 0`),
		index('credentials_user_id_idx').on(t.userId)
	]
);

export const sessions = pgTable(
	'sessions',
	{
		id: uuid('id').primaryKey().defaultRandom(),
		userId: uuid('user_id')
			.notNull()
			.references(() => users.id, { onDelete: 'cascade' }),
		tokenHash: text('token_hash').notNull().unique(),
		// 'recovery' sessions may only enrol a replacement credential.
		kind: text('kind', { enum: ['normal', 'recovery'] })
			.notNull()
			.default('normal'),
		createdAt: createdAt(),
		lastSeenAt: timestamp('last_seen_at', { withTimezone: true }).notNull().defaultNow(),
		expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
		// Time of the last passkey assertion; sensitive actions require it to be recent.
		verifiedAt: timestamp('verified_at', { withTimezone: true }).notNull().defaultNow()
	},
	(t) => [
		check('sessions_kind_valid', sql`${t.kind} in ('normal', 'recovery')`),
		index('sessions_user_id_idx').on(t.userId)
	]
);

export const invites = pgTable(
	'invites',
	{
		id: uuid('id').primaryKey().defaultRandom(),
		tokenHash: text('token_hash').notNull().unique(),
		note: text('note'),
		createdBy: uuid('created_by').references(() => users.id, { onDelete: 'set null' }),
		createdAt: createdAt(),
		expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
		usedAt: timestamp('used_at', { withTimezone: true }),
		usedBy: uuid('used_by').references(() => users.id, { onDelete: 'set null' }),
		revokedAt: timestamp('revoked_at', { withTimezone: true })
	},
	(t) => [check('invites_note_length', sql`${t.note} is null or char_length(${t.note}) <= 60`)]
);

export const recoveryCodes = pgTable(
	'recovery_codes',
	{
		id: uuid('id').primaryKey().defaultRandom(),
		userId: uuid('user_id')
			.notNull()
			.references(() => users.id, { onDelete: 'cascade' }),
		codeHash: text('code_hash').notNull().unique(),
		createdAt: createdAt(),
		usedAt: timestamp('used_at', { withTimezone: true })
	},
	(t) => [index('recovery_codes_user_id_idx').on(t.userId)]
);

// Issued only by the operator command on the server (docs/design.md, "Passkeys and recovery").
export const recoveryLinks = pgTable('recovery_links', {
	id: uuid('id').primaryKey().defaultRandom(),
	userId: uuid('user_id')
		.notNull()
		.references(() => users.id, { onDelete: 'cascade' }),
	tokenHash: text('token_hash').notNull().unique(),
	createdAt: createdAt(),
	expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
	usedAt: timestamp('used_at', { withTimezone: true })
});

// Creates the first admin once; issued by the operator command.
export const bootstrapTokens = pgTable('bootstrap_tokens', {
	id: uuid('id').primaryKey().defaultRandom(),
	tokenHash: text('token_hash').notNull().unique(),
	createdAt: createdAt(),
	expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
	usedAt: timestamp('used_at', { withTimezone: true })
});
