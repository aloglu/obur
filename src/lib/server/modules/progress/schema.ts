import { sql } from 'drizzle-orm';
import { check, date, pgTable, primaryKey, text, timestamp, uuid } from 'drizzle-orm/pg-core';
import { users } from '../auth/index.ts';

/**
 * Achievements reached (shared/achievements.ts). Kept in step with the records they come from, so a deleted weigh-in
 * removes what it caused; `seen_at` remembers that one was celebrated (or arrived quietly). The first voice log has
 * no record behind it and is written when it happens.
 */
export const achievements = pgTable(
	'achievements',
	{
		userId: uuid('user_id')
			.notNull()
			.references(() => users.id, { onDelete: 'cascade' }),
		kind: text('kind', { enum: ['weight', 'goal', 'streak', 'first'] }).notNull(),
		/** Kilos for weight and goal, days for a streak, the first's name. */
		level: text('level').notNull(),
		achievedOn: date('achieved_on', { mode: 'string' }).notNull(),
		seenAt: timestamp('seen_at', { withTimezone: true }),
		createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow()
	},
	(t) => [
		primaryKey({ columns: [t.userId, t.kind, t.level] }),
		check('achievements_kind', sql`${t.kind} in ('weight', 'goal', 'streak', 'first')`),
		check(
			'achievements_level',
			sql`(${t.kind} in ('weight', 'goal') and ${t.level} ~ '^[0-9]{1,3}(\\.[0-9]{1,2})?$')
				or (${t.kind} = 'streak' and ${t.level} ~ '^[0-9]{1,4}$')
				or (${t.kind} = 'first' and ${t.level} in ('scan', 'voice', 'recipe'))`
		)
	]
);
