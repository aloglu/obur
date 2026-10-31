import { sql } from 'drizzle-orm';
import {
	check,
	date,
	index,
	integer,
	pgTable,
	primaryKey,
	text,
	time,
	timestamp,
	unique,
	uuid
} from 'drizzle-orm/pg-core';
import { users } from '../auth/index.ts';
import { REMINDER_KINDS } from '../../../shared/reminders.ts';

/** One row per person who has opened the reminder settings. A null time means that reminder is off. */
export const reminderSettings = pgTable(
	'reminder_settings',
	{
		userId: uuid('user_id')
			.primaryKey()
			.references(() => users.id, { onDelete: 'cascade' }),
		zone: text('zone').notNull(),
		breakfast: time('breakfast'),
		lunch: time('lunch'),
		dinner: time('dinner'),
		weighIn: time('weigh_in'),
		dayComplete: time('day_complete'),
		quietStart: time('quiet_start').notNull().default('22:00'),
		quietEnd: time('quiet_end').notNull().default('08:00'),
		updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow()
	},
	(t) => [check('reminder_settings_zone_length', sql`length(${t.zone}) between 1 and 64`)]
);

/**
 * A device's Web Push subscription for a person (the browser's endpoint and keys). Credentials, never exported.
 * The same device may be subscribed for more than one person on it.
 */
export const pushSubscriptions = pgTable(
	'push_subscriptions',
	{
		id: uuid('id').primaryKey().defaultRandom(),
		userId: uuid('user_id')
			.notNull()
			.references(() => users.id, { onDelete: 'cascade' }),
		endpoint: text('endpoint').notNull(),
		p256dh: text('p256dh').notNull(),
		auth: text('auth').notNull(),
		createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
		lastSentAt: timestamp('last_sent_at', { withTimezone: true }),
		failures: integer('failures').notNull().default(0)
	},
	(t) => [
		unique('push_subscriptions_user_endpoint').on(t.userId, t.endpoint),
		check(
			'push_subscriptions_sizes',
			sql`length(${t.endpoint}) <= 2048 and length(${t.p256dh}) <= 200 and length(${t.auth}) <= 100`
		),
		index('push_subscriptions_user_id_idx').on(t.userId)
	]
);

/** Which reminder was sent for which local day: at most one each, even with two workers running. */
export const reminderSends = pgTable(
	'reminder_sends',
	{
		userId: uuid('user_id')
			.notNull()
			.references(() => users.id, { onDelete: 'cascade' }),
		kind: text('kind', { enum: REMINDER_KINDS }).notNull(),
		localDate: date('local_date', { mode: 'string' }).notNull(),
		sentAt: timestamp('sent_at', { withTimezone: true }).notNull().defaultNow()
	},
	(t) => [
		primaryKey({ columns: [t.userId, t.kind, t.localDate] }),
		check(
			'reminder_sends_kind',
			sql`${t.kind} in ('breakfast', 'lunch', 'dinner', 'weigh_in', 'day_complete')`
		)
	]
);
