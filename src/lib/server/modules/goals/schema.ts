import { sql } from 'drizzle-orm';
import {
	boolean,
	check,
	date,
	index,
	integer,
	jsonb,
	numeric,
	pgTable,
	smallint,
	text,
	timestamp,
	uuid
} from 'drizzle-orm/pg-core';
import { users } from '../auth/index.ts';

// RLS policies and grants live in hand-written migrations under drizzle/. Profile facts are collected only for
// target calculations and stay private to the person (no admin access).

export const profiles = pgTable(
	'profiles',
	{
		userId: uuid('user_id')
			.primaryKey()
			.references(() => users.id, { onDelete: 'cascade' }),
		heightCm: numeric('height_cm', { precision: 5, scale: 1, mode: 'number' }),
		birthDate: date('birth_date', { mode: 'string' }),
		sex: text('sex', { enum: ['female', 'male'] }),
		bodyFatPct: numeric('body_fat_pct', { precision: 4, scale: 1, mode: 'number' }),
		waistCm: numeric('waist_cm', { precision: 5, scale: 1, mode: 'number' }),
		pregnant: boolean('pregnant').notNull().default(false),
		breastfeeding: boolean('breastfeeding').notNull().default(false),
		decimalMark: text('decimal_mark', { enum: [',', '.'] })
			.notNull()
			.default(','),
		// ISO weekday: 1 = Monday, 7 = Sunday.
		firstDayOfWeek: smallint('first_day_of_week').notNull().default(1),
		// Settings that follow the person (shared/preferences.ts). The app icon is null for the default.
		appIcon: text('app_icon'),
		themeMode: text('theme_mode', { enum: ['system', 'light', 'dark'] })
			.notNull()
			.default('system'),
		palette: text('palette').notNull().default('pazar'),
		timeFormat: text('time_format', { enum: ['device', '24', '12'] })
			.notNull()
			.default('device'),
		weightView: text('weight_view', { enum: ['readings', 'trend'] })
			.notNull()
			.default('readings'),
		voiceOffSeen: boolean('voice_off_seen').notNull().default(false),
		holdHintSeen: boolean('hold_hint_seen').notNull().default(false),
		/** When the settings were first saved to the account; until then a browser's own choices are taken over. */
		preferencesSavedAt: timestamp('preferences_saved_at', { withTimezone: true }),
		updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow()
	},
	(t) => [
		check('profiles_height_range', sql`${t.heightCm} is null or ${t.heightCm} between 50 and 260`),
		check(
			'profiles_body_fat_range',
			sql`${t.bodyFatPct} is null or ${t.bodyFatPct} between 2 and 75`
		),
		check('profiles_waist_range', sql`${t.waistCm} is null or ${t.waistCm} between 30 and 250`),
		check('profiles_sex_valid', sql`${t.sex} is null or ${t.sex} in ('female', 'male')`),
		check('profiles_theme_mode_valid', sql`${t.themeMode} in ('system', 'light', 'dark')`),
		check(
			'profiles_palette_valid',
			sql`${t.palette} in ('pazar', 'sade', 'zerde', 'patlican', 'zeytin', 'disko', 'kaset', 'sinyal')`
		),
		check('profiles_time_format_valid', sql`${t.timeFormat} in ('device', '24', '12')`),
		check('profiles_weight_view_valid', sql`${t.weightView} in ('readings', 'trend')`),
		check(
			'profiles_app_icon_valid',
			sql`${t.appIcon} is null or ${t.appIcon} in ('pazar', 'pazar-light', 'sade', 'zerde', 'patlican', 'zeytin', 'disko', 'kaset', 'sinyal')`
		),
		check(
			'profiles_birth_date_range',
			sql`${t.birthDate} is null or ${t.birthDate} between '1900-01-01' and '2100-01-01'`
		),
		check('profiles_decimal_mark_valid', sql`${t.decimalMark} in (',', '.')`),
		check('profiles_first_day_valid', sql`${t.firstDayOfWeek} between 1 and 7`)
	]
);

// Targets by effective date. Rows are never updated: a correction is a new row, and for a day the newest row
// among those with the latest effective_from on or before it applies. Computed numbers are stored, so changing
// a formula never rewrites past days.
export const goalVersions = pgTable(
	'goal_versions',
	{
		id: uuid('id').primaryKey().defaultRandom(),
		userId: uuid('user_id')
			.notNull()
			.references(() => users.id, { onDelete: 'cascade' }),
		effectiveFrom: date('effective_from', { mode: 'string' }).notNull(),
		// calculated: from the profile; manual: a number the person (or their professional) set; none: no target.
		mode: text('mode', { enum: ['calculated', 'manual', 'none'] }).notNull(),
		baseBurnKcal: integer('base_burn_kcal'),
		deficitKcal: integer('deficit_kcal').notNull().default(0),
		floorKcal: integer('floor_kcal').notNull().default(0),
		goalWeightKg: numeric('goal_weight_kg', { precision: 6, scale: 2, mode: 'number' }),
		rateKgPerWeek: numeric('rate_kg_per_week', { precision: 4, scale: 2, mode: 'number' }),
		proteinGPerKg: numeric('protein_g_per_kg', { precision: 4, scale: 2, mode: 'number' }),
		proteinBasisKg: numeric('protein_basis_kg', { precision: 6, scale: 2, mode: 'number' }),
		fatShare: numeric('fat_share', { precision: 3, scale: 2, mode: 'number' }),
		// Macro targets: balanced (protein from body weight, fat_share of the budget, carbohydrate the rest; calculated
		// targets only) or percent (the person's own shares of the day's budget; any budget). Percent shares add up to 1.
		macroMode: text('macro_mode', { enum: ['balanced', 'percent'] })
			.notNull()
			.default('balanced'),
		proteinShare: numeric('protein_share', { precision: 3, scale: 2, mode: 'number' }),
		carbShare: numeric('carb_share', { precision: 3, scale: 2, mode: 'number' }),
		// The inputs and formula used, for audit (weight, height, age, sex, body fat, formula, factor).
		inputs: jsonb('inputs').notNull(),
		// Settings that travel with the target: whether counted activity adds to the budget, and what a calculated
		// target does once the goal weight is reached (keep the deficit, or switch to maintenance).
		countActivity: boolean('count_activity').notNull().default(true),
		atGoal: text('at_goal', { enum: ['keep', 'maintain'] })
			.notNull()
			.default('keep'),
		calculationVersion: text('calculation_version').notNull(),
		createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow()
	},
	(t) => [
		check('goal_versions_mode_valid', sql`${t.mode} in ('calculated', 'manual', 'none')`),
		check(
			'goal_versions_base_burn',
			sql`(${t.mode} = 'none') = (${t.baseBurnKcal} is null)
				and (${t.baseBurnKcal} is null or ${t.baseBurnKcal} between 500 and 10000)`
		),
		check('goal_versions_deficit_range', sql`${t.deficitKcal} between 0 and 1100`),
		check('goal_versions_at_goal_valid', sql`${t.atGoal} in ('keep', 'maintain')`),
		check('goal_versions_floor_range', sql`${t.floorKcal} between 0 and 5000`),
		check(
			'goal_versions_rate_range',
			sql`${t.rateKgPerWeek} is null or ${t.rateKgPerWeek} between 0 and 1`
		),
		check(
			'goal_versions_goal_weight_range',
			sql`${t.goalWeightKg} is null or ${t.goalWeightKg} between 20 and 700`
		),
		check(
			'goal_versions_protein_range',
			sql`${t.proteinGPerKg} is null or ${t.proteinGPerKg} between 0 and 3`
		),
		check(
			'goal_versions_fat_share_range',
			sql`${t.fatShare} is null or (${t.fatShare} between 0 and 1
				and (${t.macroMode} = 'percent' or ${t.fatShare} between 0.1 and 0.7))`
		),
		check('goal_versions_macro_mode_valid', sql`${t.macroMode} in ('balanced', 'percent')`),
		check(
			'goal_versions_macro_shares',
			sql`case when ${t.macroMode} = 'percent'
				then coalesce(${t.proteinShare} between 0 and 1 and ${t.carbShare} between 0 and 1
					and ${t.proteinShare} + ${t.carbShare} + ${t.fatShare} = 1, false)
				else ${t.proteinShare} is null and ${t.carbShare} is null end`
		),
		index('goal_versions_user_effective_idx').on(t.userId, t.effectiveFrom, t.createdAt)
	]
);
