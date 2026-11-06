// Diary operations under the signed-in person's identity (docs/design.md, "Diary and logging rules").
// Nutrition is always computed on the server from a snapshot of the food; clients send only food, amount,
// unit, day and meal.
import { randomUUID } from 'node:crypto';
import { and, asc, desc, eq, gte, inArray, isNotNull, isNull, lte, sql } from 'drizzle-orm';
import { withUser, type Database, type Tx } from '../../db/identity.ts';
import { snapshotNutrients, snapshotOf } from '../../../shared/diary-rules.ts';
import type {
	DiaryEntry,
	EntryNutrients,
	FoodSnapshot,
	Meal,
	SnapshotUnit
} from '../../../shared/diary-types.ts';
import type { BulkEntries } from '../../../shared/diary-input.ts';
import type { FoodDetail } from '../../../shared/food-types.ts';
import { dayCompletions, dayNotes, diaryEntries, purgedRecords } from './schema.ts';

/** One logged day's totals for the history (see `dailyHistory`). */
export interface DailyHistoryRow {
	localDate: string;
	kcal: number;
	protein: { value: number; missing: number };
	carbohydrate: { value: number; missing: number };
	fat: { value: number; missing: number };
}

export class DiaryError extends Error {
	/** gone: a late retry of an entry that was deleted and purged from the trash. */
	readonly code: 'not_found' | 'conflict' | 'conversion_unknown' | 'gone';
	// A plain field (not a parameter property): the worker runs this file with Node's type stripping.
	constructor(code: 'not_found' | 'conflict' | 'conversion_unknown' | 'gone') {
		super(code);
		this.code = code;
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

// The snapshot rule is shared with recipes (catalog module); re-exported here for the diary's callers.
export { snapshotOf };

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

		/**
		 * Several entries at once, all or none (shared/diary-input.ts, `BulkEntries`). Returns the affected entries as
		 * they are afterwards: the placed, the copies, the deleted (in the trash) or the restored. Copies are new
		 * entries made from the originals' own snapshots, never from the current catalog.
		 */
		async bulk(userId: string, op: BulkEntries): Promise<DiaryEntry[]> {
			return withUser(db, userId, async (tx) => {
				const ids =
					op.action === 'place' || op.action === 'copy' ? op.entries.map((e) => e.id) : op.ids;
				if (new Set(ids).size !== ids.length) throw new DiaryError('conflict');
				const rows = new Map(
					(await tx.select().from(diaryEntries).where(inArray(diaryEntries.id, ids))).map((r) => [
						r.id,
						r
					])
				);
				// Every entry must be the person's (others' rows are invisible under RLS) and, except for a
				// restore, live.
				for (const id of ids) {
					const row = rows.get(id);
					if (!row || (op.action !== 'restore' && row.deletedAt)) throw new DiaryError('not_found');
				}
				const out: DiaryEntry[] = [];
				switch (op.action) {
					case 'place':
						for (const e of op.entries) {
							const row = rows.get(e.id)!;
							if (row.revision !== e.revision) throw new DiaryError('conflict');
							const [updated] = await tx
								.update(diaryEntries)
								.set({
									localDate: e.date,
									meal: e.meal,
									revision: row.revision + 1,
									updatedAt: now()
								})
								.where(and(eq(diaryEntries.id, e.id), eq(diaryEntries.revision, e.revision)))
								.returning();
							if (!updated) throw new DiaryError('conflict');
							out.push(toEntry(updated));
						}
						break;
					case 'copy':
						for (const e of op.entries) {
							const row = rows.get(e.id)!;
							out.push(
								await insertEntry(tx, {
									id: e.copyId,
									userId,
									localDate: op.date,
									meal: op.meal,
									zone: op.zone,
									eatenAt: null,
									kind: row.kind,
									foodId: row.foodId,
									food: row.food,
									amount: row.amount,
									unit: row.unit,
									description: row.description,
									nutrients: row.nutrients,
									revision: 1,
									deletedAt: null
								})
							);
						}
						break;
					case 'delete':
						for (const id of op.ids) {
							const row = rows.get(id)!;
							const [updated] = await tx
								.update(diaryEntries)
								.set({ deletedAt: now(), revision: row.revision + 1, updatedAt: now() })
								.where(eq(diaryEntries.id, id))
								.returning();
							out.push(toEntry(updated));
						}
						break;
					case 'restore':
						for (const id of op.ids) {
							const row = rows.get(id)!;
							if (!row.deletedAt) {
								out.push(toEntry(row));
								continue;
							}
							if (now().getTime() - row.deletedAt.getTime() > TRASH_DAYS * 24 * 3600 * 1000)
								throw new DiaryError('not_found');
							const [updated] = await tx
								.update(diaryEntries)
								.set({ deletedAt: null, revision: row.revision + 1, updatedAt: now() })
								.where(eq(diaryEntries.id, id))
								.returning();
							out.push(toEntry(updated));
						}
						break;
				}
				return out;
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

		/**
		 * Per logged day in a range: energy, and protein, carbohydrate (excluding fibre) and fat with the number of
		 * entries that don't state each one, so a partial day is never read as a full one (docs/design.md, History).
		 */
		async dailyHistory(userId: string, from: string, to: string): Promise<DailyHistoryRow[]> {
			// Fixed nutrient codes, written into the SQL as literals.
			const part = (code: 'protein' | 'carbohydrate_excl_fibre' | 'fat') => {
				const key = sql.raw(`'${code}'`);
				return {
					sum: sql<string>`coalesce(sum((${diaryEntries.nutrients} -> ${key} ->> 'value')::numeric), 0)`,
					missing: sql<number>`(count(*) filter (where ${diaryEntries.nutrients} -> ${key} is null))::int`
				};
			};
			const [protein, carbohydrate, fat] = (
				['protein', 'carbohydrate_excl_fibre', 'fat'] as const
			).map(part);
			const rows = await withUser(db, userId, (tx) =>
				tx
					.select({
						localDate: diaryEntries.localDate,
						kcal: sql<string>`coalesce(sum(${diaryEntries.energyKcal}), 0)`,
						protein: protein.sum,
						proteinMissing: protein.missing,
						carbohydrate: carbohydrate.sum,
						carbohydrateMissing: carbohydrate.missing,
						fat: fat.sum,
						fatMissing: fat.missing
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
			return rows.map((r) => ({
				localDate: r.localDate,
				kcal: Math.round(Number(r.kcal)),
				protein: { value: Number(r.protein), missing: r.proteinMissing },
				carbohydrate: { value: Number(r.carbohydrate), missing: r.carbohydrateMissing },
				fat: { value: Number(r.fat), missing: r.fatMissing }
			}));
		},

		/** The first day with a live diary entry, or null. */
		async firstDay(userId: string): Promise<string | null> {
			const [row] = await withUser(db, userId, (tx) =>
				tx
					.select({ first: sql<string | null>`min(${diaryEntries.localDate})` })
					.from(diaryEntries)
					.where(isNull(diaryEntries.deletedAt))
			);
			return row?.first ?? null;
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

		/** The day's note, or an empty one. */
		async dayNote(
			userId: string,
			localDate: string
		): Promise<{ text: string; typedAt: string | null }> {
			const [row] = await withUser(db, userId, (tx) =>
				tx.select().from(dayNotes).where(eq(dayNotes.localDate, localDate))
			);
			return { text: row?.text ?? '', typedAt: row?.typedAt.toISOString() ?? null };
		},

		/**
		 * Saves a note unless a later-typed version is already here (the owner's explicit exception to "no
		 * last-write-wins", docs/design.md). A clock ahead of the server's counts as now, so a wrong clock can't
		 * block every later edit.
		 */
		async saveDayNote(
			userId: string,
			localDate: string,
			text: string,
			typedAt: Date
		): Promise<{ text: string; typedAt: string }> {
			const now = new Date();
			const typed = typedAt > now ? now : typedAt;
			return withUser(db, userId, async (tx) => {
				await tx
					.insert(dayNotes)
					.values({ userId, localDate, text, typedAt: typed })
					.onConflictDoUpdate({
						target: [dayNotes.userId, dayNotes.localDate],
						set: { text, typedAt: typed },
						where: sql`excluded.typed_at >= ${dayNotes.typedAt}`
					});
				const [row] = await tx.select().from(dayNotes).where(eq(dayNotes.localDate, localDate));
				return { text: row.text, typedAt: row.typedAt.toISOString() };
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
