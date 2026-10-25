import { sql } from 'drizzle-orm';
import { check, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core';

// Row-level security, policies and grants for these tables live in hand-written migrations under drizzle/.
export const users = pgTable(
	'users',
	{
		id: uuid('id').primaryKey(),
		displayName: text('display_name').notNull(),
		role: text('role', { enum: ['admin', 'member'] })
			.notNull()
			.default('member'),
		createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
		disabledAt: timestamp('disabled_at', { withTimezone: true })
	},
	(t) => [
		check('users_role_valid', sql`${t.role} in ('admin', 'member')`),
		check('users_display_name_length', sql`char_length(${t.displayName}) between 1 and 80`)
	]
);
