import { sql } from 'drizzle-orm';
import {
	boolean,
	check,
	date,
	integer,
	pgTable,
	primaryKey,
	text,
	timestamp,
	uuid
} from 'drizzle-orm/pg-core';
import { users } from '../auth/index.ts';

/**
 * A person's own API key for a provider, encrypted with the server's key (crypto.ts). Only its owner can read the
 * row, admins included; never exported. The last four characters are kept apart so the key is never decrypted to
 * show it.
 */
export const modelKeys = pgTable(
	'model_keys',
	{
		userId: uuid('user_id')
			.notNull()
			.references(() => users.id, { onDelete: 'cascade' }),
		provider: text('provider', { enum: ['openai', 'openrouter'] }).notNull(),
		ciphertext: text('ciphertext').notNull(),
		last4: text('last4').notNull(),
		checkedAt: timestamp('checked_at', { withTimezone: true }).notNull(),
		createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow()
	},
	(t) => [
		primaryKey({ columns: [t.userId, t.provider] }),
		check('model_keys_provider_valid', sql`${t.provider} in ('openai', 'openrouter')`),
		check(
			'model_keys_sizes',
			sql`length(${t.ciphertext}) <= 2048 and length(${t.last4}) between 1 and 4`
		)
	]
);

/** What reads each person's recordings and label photos, and when they allowed a provider to receive them. */
export const modelChoices = pgTable(
	'model_choices',
	{
		userId: uuid('user_id')
			.primaryKey()
			.references(() => users.id, { onDelete: 'cascade' }),
		speak: text('speak', { enum: ['server', 'openai', 'openrouter'] })
			.notNull()
			.default('server'),
		scan: text('scan', { enum: ['server', 'openai', 'openrouter'] })
			.notNull()
			.default('server'),
		speakAllowedAt: timestamp('speak_allowed_at', { withTimezone: true }),
		scanAllowedAt: timestamp('scan_allowed_at', { withTimezone: true }),
		updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow()
	},
	(t) => [
		check('model_choices_speak_valid', sql`${t.speak} in ('server', 'openai', 'openrouter')`),
		check('model_choices_scan_valid', sql`${t.scan} in ('server', 'openai', 'openrouter')`),
		// A provider is only ever chosen with the date it was allowed.
		check(
			'model_choices_allowed',
			sql`(${t.speak} = 'server' or ${t.speakAllowedAt} is not null) and (${t.scan} = 'server' or ${t.scanAllowedAt} is not null)`
		)
	]
);

/** How many recordings and photos each person sent with each key this month: counts only, never content. */
export const modelUsage = pgTable(
	'model_usage',
	{
		userId: uuid('user_id')
			.notNull()
			.references(() => users.id, { onDelete: 'cascade' }),
		month: date('month').notNull(),
		provider: text('provider', { enum: ['openai', 'openrouter'] }).notNull(),
		feature: text('feature', { enum: ['speak', 'scan'] }).notNull(),
		count: integer('count').notNull().default(0)
	},
	(t) => [
		primaryKey({ columns: [t.userId, t.month, t.provider, t.feature] }),
		check('model_usage_provider_valid', sql`${t.provider} in ('openai', 'openrouter')`),
		check('model_usage_feature_valid', sql`${t.feature} in ('speak', 'scan')`),
		check('model_usage_count', sql`${t.count} >= 0`),
		check('model_usage_month_start', sql`extract(day from ${t.month}) = 1`)
	]
);

/** Server-wide settings an admin chooses: one row. The table keeps its first name, household_settings. */
export const serverSettings = pgTable(
	'household_settings',
	{
		singleton: boolean('singleton').primaryKey().default(true),
		/** People may use their own OpenAI or OpenRouter key for Speak and Scan. */
		personalKeys: boolean('personal_keys').notNull().default(true),
		/**
		 * Ask GitHub which versions of obur are published (updates module). Off until an admin turns it on: it is the
		 * one thing obur asks an outside service by itself. The answer is kept so the question is asked once a day.
		 */
		updateCheck: boolean('update_check').notNull().default(false),
		latestVersion: text('latest_version'),
		latestCheckedAt: timestamp('latest_checked_at', { withTimezone: true }),
		updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow()
	},
	(t) => [check('household_settings_singleton', sql`${t.singleton}`)]
);
