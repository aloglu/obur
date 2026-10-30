import { sql } from 'drizzle-orm';
import {
	boolean,
	check,
	date,
	index,
	integer,
	numeric,
	pgTable,
	text,
	timestamp,
	uuid
} from 'drizzle-orm/pg-core';
import { users } from '../auth/index.ts';

// RLS policies and grants live in hand-written migrations under drizzle/. Amounts are metric; display units are
// converted at the interface. Separate readings are never merged, even when their values match.

const common = () => ({
	// Client-generated for idempotent retries.
	id: uuid('id').primaryKey(),
	userId: uuid('user_id')
		.notNull()
		.references(() => users.id, { onDelete: 'cascade' }),
	localDate: date('local_date', { mode: 'string' }).notNull(),
	zone: text('zone').notNull(),
	source: text('source', { enum: ['manual', 'loseit'] })
		.notNull()
		.default('manual'),
	revision: integer('revision').notNull().default(1),
	createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
	updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
	deletedAt: timestamp('deleted_at', { withTimezone: true })
});

export const weightEntries = pgTable(
	'weight_entries',
	{
		...common(),
		measuredAt: timestamp('measured_at', { withTimezone: true }),
		kg: numeric('kg', { precision: 6, scale: 2, mode: 'number' }).notNull()
	},
	(t) => [
		check('weight_entries_kg_range', sql`${t.kg} > 0 and ${t.kg} < 700`),
		check('weight_entries_zone_format', sql`${t.zone} ~ '^[A-Za-z_]+(/[A-Za-z0-9_+-]+)*$'`),
		check('weight_entries_source_valid', sql`${t.source} in ('manual', 'loseit')`),
		index('weight_entries_user_date_idx')
			.on(t.userId, t.localDate)
			.where(sql`${t.deletedAt} is null`)
	]
);

export const waterEntries = pgTable(
	'water_entries',
	{
		...common(),
		ml: numeric('ml', { precision: 7, scale: 1, mode: 'number' }).notNull()
	},
	(t) => [
		check('water_entries_ml_range', sql`${t.ml} > 0 and ${t.ml} <= 10000`),
		check('water_entries_zone_format', sql`${t.zone} ~ '^[A-Za-z_]+(/[A-Za-z0-9_+-]+)*$'`),
		check('water_entries_source_valid', sql`${t.source} in ('manual', 'loseit')`),
		index('water_entries_user_date_idx')
			.on(t.userId, t.localDate)
			.where(sql`${t.deletedAt} is null`)
	]
);

// Calories burned through activity, as extra above an inactive day (docs/design.md). Only rows that count toward
// the budget are added to it; imported values with an unclear meaning are recorded but not counted. `extra` rows add
// up (a workout); a `day_total` row is a watch's active calories for the day so far, and the newest one replaces the
// earlier ones that day.
export const activityEntries = pgTable(
	'activity_entries',
	{
		...common(),
		kcal: integer('kcal').notNull(),
		note: text('note'),
		countsTowardBudget: boolean('counts_toward_budget').notNull(),
		kind: text('kind', { enum: ['extra', 'day_total'] })
			.notNull()
			.default('extra')
	},
	(t) => [
		check('activity_entries_kcal_range', sql`${t.kcal} > 0 and ${t.kcal} <= 10000`),
		check(
			'activity_entries_note_length',
			sql`${t.note} is null or char_length(${t.note}) between 1 and 120`
		),
		check('activity_entries_zone_format', sql`${t.zone} ~ '^[A-Za-z_]+(/[A-Za-z0-9_+-]+)*$'`),
		check('activity_entries_source_valid', sql`${t.source} in ('manual', 'loseit')`),
		check('activity_entries_kind_valid', sql`${t.kind} in ('extra', 'day_total')`),
		check(
			'activity_entries_manual_counts',
			sql`${t.source} <> 'manual' or ${t.countsTowardBudget}`
		),
		index('activity_entries_user_date_idx')
			.on(t.userId, t.localDate)
			.where(sql`${t.deletedAt} is null`)
	]
);
