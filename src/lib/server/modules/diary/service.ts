// Diary operations under the signed-in person's identity (docs/design.md, "Diary and logging rules").
// Nutrition is always computed on the server from a snapshot of the food; clients send only food, amount,
// unit, day and meal.
import { randomUUID } from 'node:crypto';
import { and, asc, desc, eq, gte, isNotNull, isNull, lte, sql } from 'drizzle-orm';
import { withUser, type Database, type Tx } from '../../db/identity.ts';
import { snapshotNutrients } from '../../../shared/diary-rules.ts';
import type {
	DiaryEntry,
	EntryNutrients,
	FoodSnapshot,
	Meal,
	SnapshotUnit
} from '../../../shared/diary-types.ts';
import type { FoodDetail } from '../../../shared/food-types.ts';
import { dayCompletions, diaryEntries, purgedRecords } from './schema.ts';

export class DiaryError extends Error {
	/** gone: a late retry of an entry that was deleted and purged from the trash. */
	constructor(readonly code: 'not_found' | 'conflict' | 'conversion_unknown' | 'gone') {
		super(code);
	}
}

export interface EntryContext {
	/** Client-generated ID for idempotent retries; generated here when absent. */
	id?: string;
	localDate: string;
	meal: Meal;
	zone: string;
	eatenAt?: Date | null;
}

/** A unit as the client sends it; resolved against the food and household measures. */
export type UnitInput =
	| { kind: 'mass'; unit: 'g' | 'kg' | 'oz' | 'lb' }
	| { kind: 'volume'; unit: 'ml' | 'l' | 'us_cup' | 'metric_cup' | 'us_fl_oz' | 'imp_fl_oz' }
	| { kind: 'measure'; code: string }
	| { kind: 'basis_serving' }
	| { kind: 'serving'; servingId: string };

export interface Measure {
	code: string;
	name: string;
	ml: number;
}

const TRASH_DAYS = 30;

/** Resolves a client unit into a stored unit, or undefined if it does not exist for this food. */
export function resolveUnit(
	input: UnitInput,
	servings: FoodSnapshot['servings'],
	measures: Measure[]
): SnapshotUnit | undefined {
	if (input.kind === 'measure') {
		const m = measures.find((x) => x.code === input.code);
		return m && { kind: 'measure', code: m.code, name: m.name, ml: m.ml };
	}
	if (input.kind === 'serving') {
		const s = servings.find((x) => x.id === input.servingId);
		return s && { kind: 'serving', servingId: s.id, name: s.name, amount: s.amount, unit: s.unit };
	}
	return input;
}

export function snapshotOf(food: FoodDetail): FoodSnapshot {
	return {
		name: food.name,
		brand: food.brand,
		basis: food.basis,
		servingLabel: food.servingLabel,
		servingSize: food.servingSize ?? null,
		servings: food.servings,
		basisNutrients: food.nutrients
	};
}

type Row = typeof diaryEntries.$inferSelect;

function toEntry(r: Row): DiaryEntry {
	return {
		id: r.id,
		localDate: r.localDate,
		meal: r.meal,
		zone: r.zone,
		kind: r.kind,
		foodId: r.foodId,
		food: r.food ?? null,
		amount: r.amount,
		unit: r.unit ?? null,
		description: r.description,
		nutrients: r.nutrients,
		revision: r.revision,
		createdAt: r.createdAt.toISOString()
	};
}

/** What a create request contained, to recognise a retry of the same request. */
function sameRequest(
	existing: Row,
	candidate: Omit<Row, 'createdAt' | 'updatedAt' | 'energyKcal'>
): boolean {
	const pick = (r: Partial<Row>) =>
		JSON.stringify([
			r.localDate,
			r.meal,
			r.zone,
			r.kind,
			r.foodId,
			r.amount,
			r.unit,
			r.description,
			r.eatenAt?.toISOString?.() ?? null,
			// A quick add's calories are its content. A food entry's nutrition follows from food, amount and
			// unit, so it is not compared: a retry after the food was edited is still the same request.
			r.kind === 'quick' ? (r.nutrients?.energy_kcal?.value ?? null) : null
		]);
	return pick(existing) === pick(candidate);
}

/**
 * Inserts an entry inside the caller's transaction, or returns the existing one for a retry of the same request.
 * A reused ID with different content is a conflict; a purged ID is gone.
 */
export async function insertEntry(
	tx: Tx,
	values: Omit<Row, 'createdAt' | 'updatedAt' | 'energyKcal'>
): Promise<DiaryEntry> {
	const [existing] = await tx.select().from(diaryEntries).where(eq(diaryEntries.id, values.id));
	if (existing) {
		if (!sameRequest(existing, values)) throw new DiaryError('conflict');
		return toEntry(existing);
	}
	const [purged] = await tx
		.select({ id: purgedRecords.id })
		.from(purgedRecords)
		.where(eq(purgedRecords.id, values.id));
	if (purged) throw new DiaryError('gone');
	try {
		const [row] = await tx.insert(diaryEntries).values(values).returning();
		return toEntry(row);
	} catch (e) {
		// Another person's row with this ID (invisible under RLS) or a concurrent identical retry.
		const code = (e as { cause?: { code?: string } }).cause?.code;
		if (code === '23505') throw new DiaryError('conflict');
		throw e;
	}
}

export function createDiary(db: Database, now: () => Date = () => new Date()) {
	async function insert(
		userId: string,
		values: Omit<Row, 'createdAt' | 'updatedAt' | 'energyKcal'>
	): Promise<DiaryEntry> {
		return withUser(db, userId, (tx) => insertEntry(tx, values));
	}

	async function current(tx: Tx, id: string): Promise<Row> {
		const [row] = await tx.select().from(diaryEntries).where(eq(diaryEntries.id, id));
		if (!row) throw new DiaryError('not_found');
		return row;
	}

	return {
		/** One live (not trashed) entry. */
		async get(userId: string, id: string): Promise<DiaryEntry> {
			const row = await withUser(db, userId, (tx) => current(tx, id));
			if (row.deletedAt) throw new DiaryError('not_found');
			return toEntry(row);
		},

		async day(userId: string, localDate: string): Promise<DiaryEntry[]> {
			const rows = await withUser(db, userId, (tx) =>
				tx
					.select()
					.from(diaryEntries)
					.where(and(eq(diaryEntries.localDate, localDate), isNull(diaryEntries.deletedAt)))
					.orderBy(asc(diaryEntries.createdAt))
			);
			return rows.map(toEntry);
		},

		async logFood(
			userId: string,
			ctx: EntryContext,
			food: FoodDetail,
			amount: number,
			unit: SnapshotUnit
		): Promise<DiaryEntry> {
			const snapshot = snapshotOf(food);
			const nutrients = snapshotNutrients(snapshot, amount, unit);
			if (!nutrients) throw new DiaryError('conversion_unknown');
			return insert(userId, {
				id: ctx.id ?? randomUUID(),
				userId,
				localDate: ctx.localDate,
				meal: ctx.meal,
				zone: ctx.zone,
				eatenAt: ctx.eatenAt ?? null,
				kind: 'food',
				foodId: food.id,
				food: snapshot,
				amount,
				unit,
				description: null,
				nutrients,
				revision: 1,
				deletedAt: null
			});
		},

		/** Calories-only entry: an explicit number; every other nutrient stays unknown. */
		async quickAdd(
			userId: string,
			ctx: EntryContext,
			kcal: number,
			description: string | null
		): Promise<DiaryEntry> {
			return insert(userId, {
				id: ctx.id ?? randomUUID(),
				userId,
				localDate: ctx.localDate,
				meal: ctx.meal,
				zone: ctx.zone,
				eatenAt: ctx.eatenAt ?? null,
				kind: 'quick',
				foodId: null,
				food: null,
				amount: null,
				unit: null,
				description,
				nutrients: { energy_kcal: { value: kcal, qualifier: 'reported' } },
				revision: 1,
				deletedAt: null
			});
		},

		/**
		 * Applies an explicit correction if the entry is still at `expectedRevision`. A food entry's amount is
		 * re-scaled from its own snapshot, never from the current catalog.
		 */
		async update(
			userId: string,
			id: string,
			expectedRevision: number,
			changes: {
				amount?: number;
				unit?: SnapshotUnit;
				kcal?: number;
				description?: string | null;
				meal?: Meal;
				localDate?: string;
			}
		): Promise<DiaryEntry> {
			return withUser(db, userId, async (tx) => {
				const row = await current(tx, id);
				if (row.deletedAt) throw new DiaryError('not_found');
				if (row.revision !== expectedRevision) throw new DiaryError('conflict');
				const patch: Partial<Row> = {};
				if (changes.meal) patch.meal = changes.meal;
				if (changes.localDate) patch.localDate = changes.localDate;
				if (row.kind === 'food' && (changes.amount !== undefined || changes.unit)) {
					const amount = changes.amount ?? row.amount!;
					const unit = changes.unit ?? row.unit!;
					const nutrients = snapshotNutrients(row.food!, amount, unit);
					if (!nutrients) throw new DiaryError('conversion_unknown');
					Object.assign(patch, { amount, unit, nutrients });
				}
				if (row.kind === 'quick') {
					if (changes.kcal !== undefined) {
						patch.nutrients = {
							energy_kcal: { value: changes.kcal, qualifier: 'reported' }
						} as EntryNutrients;
					}
					if (changes.description !== undefined) patch.description = changes.description;
				}
				const [updated] = await tx
					.update(diaryEntries)
					.set({ ...patch, revision: row.revision + 1, updatedAt: now() })
					.where(and(eq(diaryEntries.id, id), eq(diaryEntries.revision, expectedRevision)))
					.returning();
				if (!updated) throw new DiaryError('conflict');
				return toEntry(updated);
			});
		},

		/** Moves an entry to the trash; it can be restored for 30 days. */
		async remove(userId: string, id: string): Promise<DiaryEntry> {
			return withUser(db, userId, async (tx) => {
				const row = await current(tx, id);
				if (row.deletedAt) return toEntry(row);
				const [updated] = await tx
					.update(diaryEntries)
					.set({ deletedAt: now(), revision: row.revision + 1, updatedAt: now() })
					.where(eq(diaryEntries.id, id))
					.returning();
				return toEntry(updated);
			});
		},

		async restore(userId: string, id: string): Promise<DiaryEntry> {
			return withUser(db, userId, async (tx) => {
				const row = await current(tx, id);
				if (!row.deletedAt) return toEntry(row);
				const age = now().getTime() - row.deletedAt.getTime();
				if (age > TRASH_DAYS * 24 * 3600 * 1000) throw new DiaryError('not_found');
				const [updated] = await tx
					.update(diaryEntries)
					.set({ deletedAt: null, revision: row.revision + 1, updatedAt: now() })
					.where(eq(diaryEntries.id, id))
					.returning();
				return toEntry(updated);
			});
		},

		/** Energy eaten per logged day in a range. Days without entries are absent (unlogged, not zero). */
		async dailyEnergy(
			userId: string,
			from: string,
			to: string
		): Promise<{ localDate: string; kcal: number }[]> {
			const rows = await withUser(db, userId, (tx) =>
				tx
					.select({
						localDate: diaryEntries.localDate,
						kcal: sql<string>`coalesce(sum(${diaryEntries.energyKcal}), 0)`
					})
					.from(diaryEntries)
					.where(
						and(
							gte(diaryEntries.localDate, from),
							lte(diaryEntries.localDate, to),
							isNull(diaryEntries.deletedAt)
						)
					)
					.groupBy(diaryEntries.localDate)
					.orderBy(asc(diaryEntries.localDate))
			);
			return rows.map((r) => ({ localDate: r.localDate, kcal: Math.round(Number(r.kcal)) }));
		},

		/** Marks a day complete (or not). Only complete days count as "under budget" in the calendar. */
		async setDayComplete(userId: string, localDate: string, complete: boolean): Promise<void> {
			await withUser(db, userId, async (tx) => {
				if (complete) {
					await tx.insert(dayCompletions).values({ userId, localDate }).onConflictDoNothing();
				} else {
					await tx
						.delete(dayCompletions)
						.where(and(eq(dayCompletions.userId, userId), eq(dayCompletions.localDate, localDate)));
				}
			});
		},

		async completedDays(userId: string, from: string, to: string): Promise<string[]> {
			const rows = await withUser(db, userId, (tx) =>
				tx
					.select({ localDate: dayCompletions.localDate })
					.from(dayCompletions)
					.where(and(gte(dayCompletions.localDate, from), lte(dayCompletions.localDate, to)))
					.orderBy(asc(dayCompletions.localDate))
			);
			return rows.map((r) => r.localDate);
		},

		/** Foods the person logged most recently, newest first. */
		async recentFoodIds(userId: string, limit = 10): Promise<string[]> {
			const rows = await withUser(db, userId, (tx) =>
				tx
					.select({ foodId: diaryEntries.foodId, last: sql<Date>`max(${diaryEntries.createdAt})` })
					.from(diaryEntries)
					.where(and(isNotNull(diaryEntries.foodId), isNull(diaryEntries.deletedAt)))
					.groupBy(diaryEntries.foodId)
					.orderBy(desc(sql`max(${diaryEntries.createdAt})`))
					.limit(limit)
			);
			return rows.map((r) => r.foodId!);
		}
	};
}

export type Diary = ReturnType<typeof createDiary>;
