// Saved meals (docs/design.md, "Diary and logging rules"): a named list of items, each keeping its own snapshot
// like a diary entry. Logging one creates ordinary, editable entries in one transaction; refreshing items to the
// catalog's current values is an explicit action. Private to the owner.
import { randomUUID } from 'node:crypto';
import { and, asc, desc, eq, inArray, isNull } from 'drizzle-orm';
import { withUser, type Database, type Tx } from '../../db/identity.ts';
import { snapshotNutrients } from '../../../shared/diary-rules.ts';
import type {
	DiaryEntry,
	SavedMeal,
	SavedMealItem,
	SavedMealSummary,
	SnapshotUnit
} from '../../../shared/diary-types.ts';
import type { FoodDetail } from '../../../shared/food-types.ts';
import { diaryEntries, savedMealItems, savedMeals } from './schema.ts';
import { DiaryError, insertEntry, snapshotOf, type EntryContext } from './service.ts';

export const MAX_ITEMS = 100;

type MealRow = typeof savedMeals.$inferSelect;
type ItemRow = typeof savedMealItems.$inferSelect;

const toItem = (r: ItemRow): SavedMealItem => ({
	id: r.id,
	kind: r.kind,
	foodId: r.foodId,
	food: r.food ?? null,
	amount: r.amount,
	unit: r.unit ?? null,
	description: r.description,
	nutrients: r.nutrients
});

function summary(meal: MealRow, items: Pick<ItemRow, 'nutrients'>[]): SavedMealSummary {
	const energies = items.map((i) => i.nutrients.energy_kcal?.value);
	return {
		id: meal.id,
		name: meal.name,
		itemCount: items.length,
		kcal: energies.reduce<number>((sum, v) => sum + (v ?? 0), 0),
		partial: energies.some((v) => v === undefined),
		revision: meal.revision,
		updatedAt: meal.updatedAt.toISOString()
	};
}

/**
 * A unit as it applies to the food's current servings: the same serving, or one with the same name (editing a food
 * recreates its servings); undefined when no such serving exists any more.
 */
function currentUnit(unit: SnapshotUnit, food: FoodDetail): SnapshotUnit | undefined {
	if (unit.kind !== 'serving') return unit;
	const name = unit.name.toLocaleLowerCase('tr');
	const s =
		food.servings.find((x) => x.id === unit.servingId) ??
		food.servings.find((x) => x.name.toLocaleLowerCase('tr') === name);
	return s && { kind: 'serving', servingId: s.id, name: s.name, amount: s.amount, unit: s.unit };
}

export function createSavedMeals(db: Database, now: () => Date = () => new Date()) {
	async function load(tx: Tx, id: string): Promise<SavedMeal> {
		const [meal] = await tx.select().from(savedMeals).where(eq(savedMeals.id, id));
		if (!meal) throw new DiaryError('not_found');
		const items = await tx
			.select()
			.from(savedMealItems)
			.where(eq(savedMealItems.savedMealId, id))
			.orderBy(asc(savedMealItems.position));
		return { ...summary(meal, items), items: items.map(toItem) };
	}

	return {
		/** All of the person's saved meals, most recently changed first. */
		async list(userId: string): Promise<SavedMealSummary[]> {
			return withUser(db, userId, async (tx) => {
				const meals = await tx
					.select()
					.from(savedMeals)
					.orderBy(desc(savedMeals.updatedAt))
					.limit(500);
				if (meals.length === 0) return [];
				const items = await tx
					.select({ savedMealId: savedMealItems.savedMealId, nutrients: savedMealItems.nutrients })
					.from(savedMealItems)
					.where(
						inArray(
							savedMealItems.savedMealId,
							meals.map((m) => m.id)
						)
					);
				return meals.map((m) =>
					summary(
						m,
						items.filter((i) => i.savedMealId === m.id)
					)
				);
			});
		},

		async get(userId: string, id: string): Promise<SavedMeal> {
			return withUser(db, userId, (tx) => load(tx, id));
		},

		/**
		 * Saves live diary entries, in the given order, as a new meal. Idempotent by ID: a retry with the same name
		 * returns the meal; anything else reusing the ID is a conflict.
		 */
		async createFromEntries(
			userId: string,
			input: { id?: string; name: string; entryIds: string[] }
		): Promise<SavedMeal> {
			const id = input.id ?? randomUUID();
			const ids = [...new Set(input.entryIds)];
			if (ids.length === 0 || ids.length > MAX_ITEMS) throw new DiaryError('not_found');
			return withUser(db, userId, async (tx) => {
				const [existing] = await tx.select().from(savedMeals).where(eq(savedMeals.id, id));
				if (existing) {
					if (existing.name !== input.name) throw new DiaryError('conflict');
					return load(tx, id);
				}
				const entries = await tx
					.select()
					.from(diaryEntries)
					.where(and(inArray(diaryEntries.id, ids), isNull(diaryEntries.deletedAt)));
				if (entries.length !== ids.length) throw new DiaryError('not_found');
				const byId = new Map(entries.map((e) => [e.id, e]));
				try {
					await tx.insert(savedMeals).values({ id, userId, name: input.name });
				} catch (e) {
					// Another person's meal with this ID, invisible under RLS.
					if ((e as { cause?: { code?: string } }).cause?.code === '23505')
						throw new DiaryError('conflict');
					throw e;
				}
				await tx.insert(savedMealItems).values(
					ids.map((entryId, position) => {
						const e = byId.get(entryId)!;
						return {
							id: randomUUID(),
							savedMealId: id,
							userId,
							position,
							kind: e.kind,
							foodId: e.foodId,
							food: e.food,
							amount: e.amount,
							unit: e.unit,
							description: e.description,
							nutrients: e.nutrients
						};
					})
				);
				return load(tx, id);
			});
		},

		async rename(
			userId: string,
			id: string,
			expectedRevision: number,
			name: string
		): Promise<SavedMeal> {
			return withUser(db, userId, async (tx) => {
				const [updated] = await tx
					.update(savedMeals)
					.set({ name, revision: expectedRevision + 1, updatedAt: now() })
					.where(and(eq(savedMeals.id, id), eq(savedMeals.revision, expectedRevision)))
					.returning();
				if (!updated) {
					await load(tx, id); // not_found when it does not exist
					throw new DiaryError('conflict');
				}
				return load(tx, id);
			});
		},

		/** Deletes a saved meal and its items. Entries logged from it are ordinary entries and stay. */
		async remove(userId: string, id: string): Promise<void> {
			await withUser(db, userId, async (tx) => {
				const deleted = await tx
					.delete(savedMeals)
					.where(eq(savedMeals.id, id))
					.returning({ id: savedMeals.id });
				if (deleted.length === 0) throw new DiaryError('not_found');
			});
		},

		/**
		 * Explicitly refreshes food items to the catalog's current values, keeping each item's amount and unit.
		 * `foods` holds the current version of every food the person can still see. Items whose food is gone or no
		 * longer visible, whose serving was removed, or that can no longer be converted keep their snapshot.
		 */
		async refresh(
			userId: string,
			id: string,
			expectedRevision: number,
			foods: Map<string, FoodDetail>
		): Promise<{ meal: SavedMeal; refreshed: number; kept: number }> {
			return withUser(db, userId, async (tx) => {
				const meal = await load(tx, id);
				if (meal.revision !== expectedRevision) throw new DiaryError('conflict');
				let refreshed = 0;
				let kept = 0;
				for (const item of meal.items) {
					if (item.kind !== 'food') continue;
					const food = item.foodId ? foods.get(item.foodId) : undefined;
					const unit = food && currentUnit(item.unit!, food);
					const snapshot = food && snapshotOf(food);
					const nutrients = snapshot && unit && snapshotNutrients(snapshot, item.amount!, unit);
					if (!nutrients) {
						kept += 1;
						continue;
					}
					await tx
						.update(savedMealItems)
						.set({ food: snapshot, unit, nutrients })
						.where(eq(savedMealItems.id, item.id));
					refreshed += 1;
				}
				await tx
					.update(savedMeals)
					.set({ revision: meal.revision + 1, updatedAt: now() })
					.where(eq(savedMeals.id, id));
				return { meal: await load(tx, id), refreshed, kept };
			});
		},

		/**
		 * Logs chosen items as ordinary entries, all or nothing. Each item carries a client entry ID, so a retry
		 * returns the same entries instead of logging twice.
		 */
		async log(
			userId: string,
			id: string,
			ctx: Omit<EntryContext, 'id'>,
			picks: { itemId: string; entryId: string }[]
		): Promise<DiaryEntry[]> {
			if (picks.length === 0 || picks.length > MAX_ITEMS) throw new DiaryError('not_found');
			return withUser(db, userId, async (tx) => {
				const meal = await load(tx, id);
				const items = new Map(meal.items.map((i) => [i.id, i]));
				const entries: DiaryEntry[] = [];
				for (const pick of picks) {
					const item = items.get(pick.itemId);
					if (!item) throw new DiaryError('not_found');
					entries.push(
						await insertEntry(tx, {
							id: pick.entryId,
							userId,
							localDate: ctx.localDate,
							meal: ctx.meal,
							zone: ctx.zone,
							eatenAt: ctx.eatenAt ?? null,
							kind: item.kind,
							foodId: item.foodId,
							food: item.food,
							amount: item.amount,
							unit: item.unit,
							description: item.description,
							nutrients: item.nutrients,
							revision: 1,
							deletedAt: null
						})
					);
				}
				return entries;
			});
		}
	};
}

export type SavedMeals = ReturnType<typeof createSavedMeals>;
