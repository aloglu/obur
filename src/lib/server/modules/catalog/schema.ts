import { sql } from 'drizzle-orm';
import {
	check,
	index,
	uniqueIndex,
	integer,
	jsonb,
	numeric,
	pgTable,
	text,
	timestamp,
	unique,
	uuid,
	type AnyPgColumn
} from 'drizzle-orm/pg-core';
import { users } from '../auth/index.ts';
import type { EntryNutrients, FoodSnapshot, SnapshotUnit } from '../../../shared/diary-types.ts';
import { NUTRIENT_CODES, QUALIFIERS } from '../../../shared/nutrients.ts';

// RLS policies and grants for these tables live in hand-written migrations under drizzle/.

const inList = (values: readonly string[]) => sql.raw(values.map((v) => `'${v}'`).join(', '));
// Exact decimals for amounts and nutrients; read as strings by the driver and converted at the edge.
const amount = (name: string) => numeric(name, { precision: 12, scale: 4, mode: 'number' });

export const foods = pgTable(
	'foods',
	{
		id: uuid('id').primaryKey().defaultRandom(),
		// Null only for curated reference foods or shared foods whose creator deleted their account.
		ownerId: uuid('owner_id').references(() => users.id, { onDelete: 'set null' }),
		visibility: text('visibility', { enum: ['private', 'shared'] }).notNull(),
		name: text('name').notNull(),
		brand: text('brand'),
		searchKey: text('search_key').notNull(),
		basis: text('basis', { enum: ['100g', '100ml', 'serving'] }).notNull(),
		// For a per-serving basis: what one serving is ("1 slice"), and its size when the source states it.
		servingLabel: text('serving_label'),
		servingAmount: amount('serving_amount'),
		servingUnit: text('serving_unit', { enum: ['g', 'ml'] }),
		barcode: text('barcode'),
		// The food's chosen OpenMoji icon (hexcode, shared/food-icons.ts); null shows the one its name suggests.
		icon: text('icon'),
		origin: text('origin', {
			enum: ['manual', 'label_scan', 'loseit', 'curated', 'variant', 'recipe']
		}).notNull(),
		// Provenance such as dataset release and source record ID; informational only.
		sourceMeta: jsonb('source_meta'),
		derivedFrom: uuid('derived_from').references((): AnyPgColumn => foods.id, {
			onDelete: 'set null'
		}),
		archivedAt: timestamp('archived_at', { withTimezone: true }),
		version: integer('version').notNull().default(1),
		createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
		updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow()
	},
	(t) => [
		check('foods_private_has_owner', sql`${t.visibility} = 'shared' or ${t.ownerId} is not null`),
		check('foods_name_length', sql`char_length(${t.name}) between 1 and 200`),
		check(
			'foods_brand_length',
			sql`${t.brand} is null or char_length(${t.brand}) between 1 and 120`
		),
		check('foods_serving_basis', sql`(${t.basis} = 'serving') = (${t.servingLabel} is not null)`),
		check(
			'foods_serving_size',
			sql`(${t.servingAmount} is null) = (${t.servingUnit} is null)
				and (${t.servingAmount} is null or (${t.basis} = 'serving' and ${t.servingAmount} > 0))`
		),
		check('foods_barcode_digits', sql`${t.barcode} is null or ${t.barcode} ~ '^[0-9]{8,14}$'`),
		check(
			'foods_icon_format',
			sql`${t.icon} is null or ${t.icon} ~ '^[0-9A-F]{4,5}(-[0-9A-F]{4,5}){0,3}$'`
		),
		check('foods_version_positive', sql`${t.version} >= 1`),
		index('foods_owner_id_idx').on(t.ownerId),
		index('foods_barcode_idx').on(t.barcode),
		// A curated food is loaded once per reference record (dataset and ID), so reloading never duplicates it.
		uniqueIndex('foods_curated_source_idx')
			.on(sql`(${t.sourceMeta} ->> 'dataset')`, sql`(${t.sourceMeta} ->> 'fdcId')`)
			.where(sql`${t.origin} = 'curated'`),
		index('foods_search_key_trgm_idx').using('gin', sql`${t.searchKey} gin_trgm_ops`)
	]
);

export const foodNutrients = pgTable(
	'food_nutrients',
	{
		foodId: uuid('food_id')
			.notNull()
			.references(() => foods.id, { onDelete: 'cascade' }),
		code: text('code').notNull(),
		value: amount('value').notNull(),
		qualifier: text('qualifier', { enum: QUALIFIERS }).notNull()
	},
	(t) => [
		unique('food_nutrients_food_code').on(t.foodId, t.code),
		check('food_nutrients_code_valid', sql`${t.code} in (${inList(NUTRIENT_CODES)})`),
		check('food_nutrients_qualifier_valid', sql`${t.qualifier} in (${inList(QUALIFIERS)})`),
		check('food_nutrients_value_non_negative', sql`${t.value} >= 0`)
	]
);

export const foodServings = pgTable(
	'food_servings',
	{
		id: uuid('id').primaryKey().defaultRandom(),
		foodId: uuid('food_id')
			.notNull()
			.references(() => foods.id, { onDelete: 'cascade' }),
		name: text('name').notNull(),
		amount: amount('amount').notNull(),
		unit: text('unit', { enum: ['g', 'ml'] }).notNull(),
		// 'label' when printed on the package, 'user' when entered, 'estimate' when explicitly estimated,
		// 'reference' when a reference dataset states it (USDA household portions with gram weights).
		source: text('source', { enum: ['label', 'user', 'estimate', 'reference'] }).notNull()
	},
	(t) => [
		check('food_servings_name_length', sql`char_length(${t.name}) between 1 and 60`),
		check('food_servings_amount_positive', sql`${t.amount} > 0`),
		check('food_servings_unit_valid', sql`${t.unit} in ('g', 'ml')`),
		check(
			'food_servings_source_valid',
			sql`${t.source} in ('label', 'user', 'estimate', 'reference')`
		),
		index('food_servings_food_id_idx').on(t.foodId)
	]
);

// Shared household volume presets (su bardağı, yemek kaşığı …). Volume only: mass-based foods need their own
// portion sizes because no density is assumed.
export const householdMeasures = pgTable(
	'household_measures',
	{
		code: text('code').primaryKey(),
		name: text('name').notNull(),
		ml: amount('ml').notNull(),
		position: integer('position').notNull()
	},
	(t) => [check('household_measures_ml_positive', sql`${t.ml} > 0`)]
);

// Recipes (docs/design.md, "Food catalog and recipes"): a recipe is a food (origin 'recipe', per serving) whose
// values are the sum of its ingredients divided by its servings. Ingredients are pinned as snapshots, like diary
// entries, so catalog edits never change a recipe until its owner updates it. Only the owner sees the ingredients;
// others who can see a shared recipe see it as a plain food with totals. owner_id cascades, so deleting an account
// always removes its ingredient lists, even when the recipe's food stays shared.
export const recipes = pgTable(
	'recipes',
	{
		foodId: uuid('food_id')
			.primaryKey()
			.references(() => foods.id, { onDelete: 'cascade' }),
		ownerId: uuid('owner_id')
			.notNull()
			.references(() => users.id, { onDelete: 'cascade' }),
		servings: numeric('servings', { precision: 8, scale: 2, mode: 'number' }).notNull(),
		// The finished dish's weight, when measured or entered; without it there are no per-gram values.
		cookedYieldG: numeric('cooked_yield_g', { precision: 10, scale: 2, mode: 'number' })
	},
	(t) => [
		check('recipes_servings_range', sql`${t.servings} > 0 and ${t.servings} <= 1000`),
		check(
			'recipes_cooked_yield_range',
			sql`${t.cookedYieldG} is null or (${t.cookedYieldG} > 0 and ${t.cookedYieldG} <= 100000)`
		),
		index('recipes_owner_id_idx').on(t.ownerId)
	]
);

export const recipeIngredients = pgTable(
	'recipe_ingredients',
	{
		id: uuid('id').primaryKey().defaultRandom(),
		recipeId: uuid('recipe_id')
			.notNull()
			.references(() => recipes.foodId, { onDelete: 'cascade' }),
		ownerId: uuid('owner_id')
			.notNull()
			.references(() => users.id, { onDelete: 'cascade' }),
		position: integer('position').notNull(),
		// The food it was taken from, while it exists; the snapshot is what the recipe uses.
		foodId: uuid('food_id').references(() => foods.id, { onDelete: 'set null' }),
		food: jsonb('food').$type<FoodSnapshot>().notNull(),
		amount: amount('amount').notNull(),
		unit: jsonb('unit').$type<SnapshotUnit>().notNull(),
		nutrients: jsonb('nutrients').$type<EntryNutrients>().notNull()
	},
	(t) => [
		unique('recipe_ingredients_position').on(t.recipeId, t.position),
		check('recipe_ingredients_position_range', sql`${t.position} between 0 and 99`),
		check('recipe_ingredients_amount_positive', sql`${t.amount} > 0`),
		index('recipe_ingredients_owner_id_idx').on(t.ownerId),
		index('recipe_ingredients_food_id_idx').on(t.foodId)
	]
);
