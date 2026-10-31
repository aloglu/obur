// Weight and water readings under the signed-in person's identity. Separate readings are never merged, even when
// their values match (docs/design.md, "Database consistency"); creates are idempotent by client ID.
import { randomUUID } from 'node:crypto';
import { and, asc, desc, eq, gte, isNull, lte, sql } from 'drizzle-orm';
import { withUser, type Database, type Tx } from '../../db/identity.ts';
import { purgedRecords } from '../diary/index.ts';
import {
	countedActivity,
	type ActivityEntry,
	type BodyReading
} from '../../../shared/body-types.ts';
import { activityEntries, waterEntries, weightEntries } from './schema.ts';

export class BodyError extends Error {
	/** gone: a late retry of a reading that was deleted and purged from the trash. */
	readonly code: 'not_found' | 'conflict' | 'gone';
	// A plain field (not a parameter property): the worker runs this file with Node's type stripping.
	constructor(code: 'not_found' | 'conflict' | 'gone') {
		super(code);
		this.code = code;
	}
}

export interface ReadingContext {
	id?: string;
	localDate: string;
	zone: string;
}

const TRASH_MS = 30 * 24 * 3600 * 1000;

type Table = typeof weightEntries | typeof waterEntries | typeof activityEntries;

const toReading = (
	r: { id: string; localDate: string; createdAt: Date; revision: number },
	value: number
): BodyReading => ({
	id: r.id,
	localDate: r.localDate,
	value,
	revision: r.revision,
	createdAt: r.createdAt.toISOString()
});

const toActivity = (r: typeof activityEntries.$inferSelect): ActivityEntry => ({
	id: r.id,
	localDate: r.localDate,
	kcal: r.kcal,
	note: r.note,
	source: r.source,
	countsTowardBudget: r.countsTowardBudget,
	kind: r.kind,
	createdAt: r.createdAt.toISOString()
});

/** Refuses a create whose ID belonged to a record already purged from the trash. */
async function refusePurged(tx: Tx, id: string) {
	const [purged] = await tx
		.select({ id: purgedRecords.id })
		.from(purgedRecords)
		.where(eq(purgedRecords.id, id));
	if (purged) throw new BodyError('gone');
}

export function createBody(db: Database, now: () => Date = () => new Date()) {
	/** Inserts a reading, or returns the existing one for a retry with the same ID and content. */
	async function insert(
		userId: string,
		table: Table,
		ctx: ReadingContext,
		value: number
	): Promise<BodyReading> {
		const id = ctx.id ?? randomUUID();
		const valueColumn = table === weightEntries ? 'kg' : 'ml';
		return withUser(db, userId, async (tx) => {
			const [existing] = await tx.select().from(table).where(eq(table.id, id));
			if (existing) {
				const same =
					existing.localDate === ctx.localDate &&
					existing.zone === ctx.zone &&
					Number((existing as Record<string, unknown>)[valueColumn]) === value;
				if (!same) throw new BodyError('conflict');
				return toReading(existing, value);
			}
			await refusePurged(tx, id);
			try {
				const [row] = await tx
					.insert(table)
					.values({
						id,
						userId,
						localDate: ctx.localDate,
						zone: ctx.zone,
						[valueColumn]: value
					} as never)
					.returning();
				return toReading(row, value);
			} catch (e) {
				if ((e as { cause?: { code?: string } }).cause?.code === '23505')
					throw new BodyError('conflict');
				throw e;
			}
		});
	}

	async function setDeleted(
		userId: string,
		table: Table,
		id: string,
		deleted: boolean
	): Promise<void> {
		await withUser(db, userId, async (tx) => {
			const [row] = await tx.select().from(table).where(eq(table.id, id));
			if (!row) throw new BodyError('not_found');
			if (Boolean(row.deletedAt) === deleted) return;
			if (!deleted && now().getTime() - row.deletedAt!.getTime() > TRASH_MS)
				throw new BodyError('not_found');
			await tx
				.update(table)
				.set({ deletedAt: deleted ? now() : null, revision: row.revision + 1, updatedAt: now() })
				.where(eq(table.id, id));
		});
	}

	/** Changes a live reading's value; a stale revision is a conflict, a deleted reading is not found. */
	async function edit(
		userId: string,
		table: typeof weightEntries | typeof waterEntries,
		id: string,
		revision: number,
		value: number
	): Promise<BodyReading> {
		const valueColumn = table === weightEntries ? 'kg' : 'ml';
		return withUser(db, userId, async (tx) => {
			const [row] = await tx.select().from(table).where(eq(table.id, id));
			if (!row || row.deletedAt) throw new BodyError('not_found');
			if (row.revision !== revision) throw new BodyError('conflict');
			const [updated] = await tx
				.update(table)
				.set({ [valueColumn]: value, revision: row.revision + 1, updatedAt: now() } as never)
				.where(and(eq(table.id, id), eq(table.revision, revision)))
				.returning();
			if (!updated) throw new BodyError('conflict');
			return toReading(updated, value);
		});
	}

	return {
		editWeight: (userId: string, id: string, revision: number, kg: number) =>
			edit(userId, weightEntries, id, revision, kg),
		editWater: (userId: string, id: string, revision: number, ml: number) =>
			edit(userId, waterEntries, id, revision, ml),
		logWeight: (userId: string, ctx: ReadingContext, kg: number) =>
			insert(userId, weightEntries, ctx, kg),
		logWater: (userId: string, ctx: ReadingContext, ml: number) =>
			insert(userId, waterEntries, ctx, ml),
		removeWeight: (userId: string, id: string) => setDeleted(userId, weightEntries, id, true),
		restoreWeight: (userId: string, id: string) => setDeleted(userId, weightEntries, id, false),
		removeWater: (userId: string, id: string) => setDeleted(userId, waterEntries, id, true),
		restoreWater: (userId: string, id: string) => setDeleted(userId, waterEntries, id, false),

		/**
		 * Manual activity: calories burned above an inactive day. Counts toward the budget: an `extra` entry adds,
		 * a `day_total` (a watch's active calories so far today) replaces the day's earlier totals.
		 */
		async logActivity(
			userId: string,
			ctx: ReadingContext,
			kcal: number,
			note: string | null,
			kind: ActivityEntry['kind'] = 'extra'
		): Promise<ActivityEntry> {
			const id = ctx.id ?? randomUUID();
			return withUser(db, userId, async (tx) => {
				const [existing] = await tx
					.select()
					.from(activityEntries)
					.where(eq(activityEntries.id, id));
				if (existing) {
					const same =
						existing.localDate === ctx.localDate &&
						existing.kcal === kcal &&
						existing.note === note &&
						existing.kind === kind;
					if (!same) throw new BodyError('conflict');
					return toActivity(existing);
				}
				await refusePurged(tx, id);
				try {
					const [row] = await tx
						.insert(activityEntries)
						.values({
							id,
							userId,
							localDate: ctx.localDate,
							zone: ctx.zone,
							kcal,
							note,
							countsTowardBudget: true,
							kind
						})
						.returning();
					return toActivity(row);
				} catch (e) {
					if ((e as { cause?: { code?: string } }).cause?.code === '23505')
						throw new BodyError('conflict');
					throw e;
				}
			});
		},
		removeActivity: (userId: string, id: string) => setDeleted(userId, activityEntries, id, true),
		restoreActivity: (userId: string, id: string) => setDeleted(userId, activityEntries, id, false),

		/** A day's activity; only entries that count toward the budget are added to `countedKcal`. */
		async activityDay(userId: string, localDate: string) {
			const rows = await withUser(db, userId, (tx) =>
				tx
					.select()
					.from(activityEntries)
					.where(and(eq(activityEntries.localDate, localDate), isNull(activityEntries.deletedAt)))
					.orderBy(asc(activityEntries.createdAt))
			);
			const entries = rows.map(toActivity);
			return { countedKcal: countedActivity(entries), entries };
		},

		/** Counted activity per day in a range, by the same rule as `countedActivity`. */
		async activityByDay(
			userId: string,
			from: string,
			to: string
		): Promise<{ localDate: string; kcal: number }[]> {
			const rows = await withUser(db, userId, (tx) =>
				tx
					.select({
						localDate: activityEntries.localDate,
						kcal: sql<string>`coalesce(sum(${activityEntries.kcal}) filter (where ${activityEntries.kind} = 'extra'), 0)
							+ coalesce((array_agg(${activityEntries.kcal} order by ${activityEntries.createdAt} desc)
								filter (where ${activityEntries.kind} = 'day_total'))[1], 0)`
					})
					.from(activityEntries)
					.where(
						and(
							gte(activityEntries.localDate, from),
							lte(activityEntries.localDate, to),
							isNull(activityEntries.deletedAt),
							eq(activityEntries.countsTowardBudget, true)
						)
					)
					.groupBy(activityEntries.localDate)
			);
			return rows.map((r) => ({ localDate: r.localDate, kcal: Number(r.kcal) }));
		},

		/** Water per day in a range (ml), for days with water recorded. */
		async waterByDay(
			userId: string,
			from: string,
			to: string
		): Promise<{ localDate: string; ml: number }[]> {
			const rows = await withUser(db, userId, (tx) =>
				tx
					.select({ localDate: waterEntries.localDate, ml: sql<string>`sum(${waterEntries.ml})` })
					.from(waterEntries)
					.where(
						and(
							gte(waterEntries.localDate, from),
							lte(waterEntries.localDate, to),
							isNull(waterEntries.deletedAt)
						)
					)
					.groupBy(waterEntries.localDate)
					.orderBy(asc(waterEntries.localDate))
			);
			return rows.map((r) => ({ localDate: r.localDate, ml: Number(r.ml) }));
		},

		/** The first day with a live weigh-in, or null. */
		async firstWeightDay(userId: string): Promise<string | null> {
			const [row] = await withUser(db, userId, (tx) =>
				tx
					.select({ first: sql<string | null>`min(${weightEntries.localDate})` })
					.from(weightEntries)
					.where(isNull(weightEntries.deletedAt))
			);
			return row?.first ?? null;
		},

		async waterDay(userId: string, localDate: string) {
			const rows = await withUser(db, userId, (tx) =>
				tx
					.select()
					.from(waterEntries)
					.where(and(eq(waterEntries.localDate, localDate), isNull(waterEntries.deletedAt)))
					.orderBy(asc(waterEntries.createdAt))
			);
			const entries = rows.map((r) => toReading(r, r.ml));
			return { totalMl: entries.reduce((sum, e) => sum + e.value, 0), entries };
		},

		/** The most recent reading on or before a day (latest day first, then latest recorded). */
		async latestWeight(userId: string, onOrBefore: string): Promise<BodyReading | null> {
			const [row] = await withUser(db, userId, (tx) =>
				tx
					.select()
					.from(weightEntries)
					.where(and(lte(weightEntries.localDate, onOrBefore), isNull(weightEntries.deletedAt)))
					.orderBy(desc(weightEntries.localDate), desc(weightEntries.createdAt))
					.limit(1)
			);
			return row ? toReading(row, row.kg) : null;
		},

		/**
		 * A page of weigh-ins, newest first (latest day, then latest recorded), after an optional cursor: the last
		 * reading of the previous page.
		 */
		async weightPage(
			userId: string,
			limit: number,
			after?: { localDate: string; createdAt: string; id: string }
		): Promise<BodyReading[]> {
			// The cursor's time has millisecond precision (JSON); compare and order on the same precision.
			const msCreated = sql`date_trunc('milliseconds', ${weightEntries.createdAt})`;
			const rows = await withUser(db, userId, (tx) =>
				tx
					.select()
					.from(weightEntries)
					.where(
						and(
							isNull(weightEntries.deletedAt),
							after
								? sql`(${weightEntries.localDate}, ${msCreated}, ${weightEntries.id}) < (${after.localDate}::date, ${after.createdAt}::timestamptz, ${after.id}::uuid)`
								: undefined
						)
					)
					.orderBy(desc(weightEntries.localDate), desc(msCreated), desc(weightEntries.id))
					.limit(limit)
			);
			return rows.map((r) => toReading(r, r.kg));
		},

		async weights(userId: string, from: string, to: string): Promise<BodyReading[]> {
			const rows = await withUser(db, userId, (tx) =>
				tx
					.select()
					.from(weightEntries)
					.where(
						and(
							gte(weightEntries.localDate, from),
							lte(weightEntries.localDate, to),
							isNull(weightEntries.deletedAt)
						)
					)
					.orderBy(asc(weightEntries.localDate), asc(weightEntries.createdAt))
			);
			return rows.map((r) => toReading(r, r.kg));
		}
	};
}

export type Body = ReturnType<typeof createBody>;
