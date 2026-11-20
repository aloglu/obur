// Food catalog operations, all under the signed-in person's identity (RLS decides who sees and edits what):
// every food is its owner's alone, and built-in foods are read-only for everyone (docs/design.md, "Foods are private").
import { and, asc, desc, eq, inArray, isNull, ne, sql } from 'drizzle-orm';
import { withUser, type Database, type Tx } from '../../db/identity.ts';
import { foodWarnings } from '../../../shared/food-checks.ts';
import type { FoodInput } from '../../../shared/food-input.ts';
import { deriveNutrients, type NutrientValue } from '../../../shared/nutrients.ts';
import { matchKey, sameFood, type MatchableFood } from '../../../shared/food-match.ts';
import type { FoodDetail, FoodSearchResult } from '../../../shared/food-types.ts';
import { foldForSearch, foodSearchKey } from '../../../shared/search-text.ts';
import { MAX_BULK_FOODS, type FoodAction } from '../../../shared/food-bulk.ts';
import type { ScanEdits } from '../../../shared/scan-edits.ts';
import {
	foodNutrients,
	foods,
	foodServings,
	householdMeasures,
	labelScanEdits,
	recipeIngredients
} from './schema.ts';

// What a bulk action does (docs/design.md, "Archived and deleted foods"): archive a food in use, restore an archived
// one, delete an archived one to Recently deleted, or bring a deleted one back to the archive.
export { MAX_BULK_FOODS, type FoodAction } from '../../../shared/food-bulk.ts';

/** A food, or recipe, in Recently deleted. */
export interface DeletedFood extends FoodSearchResult {
	recipe: boolean;
	deletedAt: string;
}

/** Totals across members of label scans saved with edit counts (counts only). */
export interface LabelScanTotals {
	scans: number;
	withoutEdits: number;
	proposed: number;
	changed: number;
	removed: number;
	added: number;
	basisUnknown: number;
	basisChanged: number;
}

export class CatalogError extends Error {
	readonly code: 'not_found' | 'forbidden' | 'conflict' | 'energy_required' | 'conversion_unknown';
	constructor(
		code: 'not_found' | 'forbidden' | 'conflict' | 'energy_required' | 'conversion_unknown'
	) {
		super(code);
		this.code = code;
	}
}

type Origin = 'manual' | 'label_scan' | 'loseit' | 'curated' | 'variant' | 'recipe';

async function writeChildren(tx: Tx, foodId: string, input: FoodInput) {
	const nutrients = deriveNutrients(input.nutrients);
	await tx.delete(foodNutrients).where(eq(foodNutrients.foodId, foodId));
	if (nutrients.length)
		await tx.insert(foodNutrients).values(nutrients.map((n) => ({ ...n, foodId })));
	// A portion keeps its ID while its name stays (the same portion, perhaps resized): an entry waiting offline and a
	// retried save name the portion chosen by its ID, and a rename or icon change must not tell them it is gone
	// (2026-11-20 audit).
	const unclaimed = await tx
		.select({ id: foodServings.id, name: foodServings.name })
		.from(foodServings)
		.where(eq(foodServings.foodId, foodId));
	const fresh: (FoodInput['servings'][number] & { foodId: string })[] = [];
	for (const s of input.servings) {
		const i = unclaimed.findIndex((u) => u.name === s.name);
		if (i < 0) {
			fresh.push({ ...s, foodId });
			continue;
		}
		const [{ id }] = unclaimed.splice(i, 1);
		await tx
			.update(foodServings)
			.set({ amount: s.amount, unit: s.unit, source: s.source })
			.where(eq(foodServings.id, id));
	}
	if (unclaimed.length)
		await tx.delete(foodServings).where(
			inArray(
				foodServings.id,
				unclaimed.map((u) => u.id)
			)
		);
	if (fresh.length) await tx.insert(foodServings).values(fresh);
}

const columns = (input: FoodInput) => ({
	name: input.name,
	brand: input.brand,
	searchKey: foodSearchKey(input.name, input.brand),
	basis: input.basis,
	servingLabel: input.basis === 'serving' ? input.servingLabel : null,
	servingAmount: input.basis === 'serving' ? (input.servingSize?.amount ?? null) : null,
	servingUnit: input.basis === 'serving' ? (input.servingSize?.unit ?? null) : null,
	barcode: input.barcode,
	icon: input.icon ?? null
});

/** A food as the signed-in person sees it (module-internal; recipes use it too). */
export async function load(tx: Tx, foodId: string): Promise<FoodDetail | undefined> {
	const [row] = await tx
		.select({
			food: foods,
			mine: sql<boolean>`${foods.ownerId} = app_current_user_id()`
		})
		.from(foods)
		// A deleted food is gone everywhere but Recently deleted.
		.where(and(eq(foods.id, foodId), isNull(foods.deletedAt)));
	if (!row) return undefined;
	const nutrients = await tx
		.select({
			code: foodNutrients.code,
			value: foodNutrients.value,
			qualifier: foodNutrients.qualifier
		})
		.from(foodNutrients)
		.where(eq(foodNutrients.foodId, foodId));
	const servings = await tx
		.select({
			id: foodServings.id,
			name: foodServings.name,
			amount: foodServings.amount,
			unit: foodServings.unit,
			source: foodServings.source
		})
		.from(foodServings)
		.where(eq(foodServings.foodId, foodId))
		.orderBy(asc(foodServings.amount));
	return toDetail(row, nutrients as NutrientValue[], servings);
}

type FoodRow = { food: typeof foods.$inferSelect; mine: boolean };

function toDetail(row: FoodRow, values: NutrientValue[], servings: FoodDetail['servings']) {
	const f = row.food;
	const detail: FoodDetail = {
		id: f.id,
		name: f.name,
		brand: f.brand,
		basis: f.basis,
		servingLabel: f.servingLabel,
		servingSize:
			f.servingAmount !== null && f.servingUnit
				? { amount: f.servingAmount, unit: f.servingUnit }
				: null,
		barcode: f.barcode,
		icon: f.icon,
		origin: f.origin,
		curatedDataset:
			f.origin === 'curated'
				? ((f.sourceMeta as { dataset?: 'sr_legacy' | 'foundation' } | null)?.dataset ?? null)
				: null,
		archived: f.archivedAt !== null,
		version: f.version,
		mine: Boolean(row.mine),
		derivedFrom: f.derivedFrom,
		nutrients: values,
		servings,
		warnings: foodWarnings(f.basis, values)
	};
	return detail;
}

/**
 * "Already in your foods": a food the person can use (their own, or a built-in one) that is the same as `food`
 * (shared/food-match.ts): the closest name first, then their own, then the most recently changed. Archived foods and
 * recipes don't count.
 */
export async function sameFoodIn(tx: Tx, food: MatchableFood): Promise<FoodSearchResult | null> {
	const words = matchKey(food.name, food.brand).split(' ').filter(Boolean);
	if (!words.length) return null;
	const rows = await tx
		.select({
			id: foods.id,
			name: foods.name,
			brand: foods.brand,
			basis: foods.basis,
			servingLabel: foods.servingLabel,
			servingAmount: foods.servingAmount,
			servingUnit: foods.servingUnit,
			icon: foods.icon,
			mine: sql<boolean>`${foods.ownerId} = app_current_user_id()`,
			curated: sql<boolean>`${foods.origin} = 'curated'`,
			kcal: foodNutrients.value
		})
		.from(foods)
		.leftJoin(
			foodNutrients,
			and(eq(foodNutrients.foodId, foods.id), eq(foodNutrients.code, 'energy_kcal'))
		)
		.where(
			and(
				sql`${foods.archivedAt} is null`,
				ne(foods.origin, 'recipe'),
				...words.map((w) => sql`${foods.searchKey} like ${`%${w}%`}`)
			)
		)
		// Closest first, so a short name ("Su") is not crowded out by longer ones that contain it; then the person's
		// own over a built-in one, then the newest.
		.orderBy(
			sql`similarity(${foods.searchKey}, ${foodSearchKey(food.name, food.brand)}) desc`,
			sql`(${foods.ownerId} = app_current_user_id()) desc nulls last`,
			sql`${foods.updatedAt} desc`
		)
		.limit(50);
	const found = rows.find((r) =>
		sameFood(food, {
			...r,
			servingSize:
				r.servingAmount !== null && r.servingUnit
					? { amount: r.servingAmount, unit: r.servingUnit }
					: null
		})
	);
	if (!found) return null;
	return {
		id: found.id,
		name: found.name,
		brand: found.brand,
		basis: found.basis,
		servingLabel: found.servingLabel,
		icon: found.icon,
		mine: Boolean(found.mine),
		curated: Boolean(found.curated),
		kcal: found.kcal
	};
}

/** A food input as the matcher compares it: its energy per basis, as the food form would store it. */
export function matchable(input: FoodInput): MatchableFood {
	const kcal = deriveNutrients(input.nutrients).find((n) => n.code === 'energy_kcal');
	return {
		name: input.name,
		brand: input.brand,
		basis: input.basis,
		servingSize: input.basis === 'serving' ? (input.servingSize ?? null) : null,
		servingLabel: input.basis === 'serving' ? input.servingLabel : null,
		kcal: kcal ? kcal.value : null
	};
}

export function createCatalog(db: Database, now: () => Date = () => new Date()) {
	return {
		async createFood(
			userId: string,
			input: FoodInput,
			options: { origin?: Origin; requireEnergy?: boolean; scanEdits?: ScanEdits } = {}
		): Promise<string> {
			const { origin = 'manual', requireEnergy = true, scanEdits } = options;
			if (
				requireEnergy &&
				!input.nutrients.some((n) => n.code === 'energy_kcal' || n.code === 'energy_kj')
			) {
				throw new CatalogError('energy_required');
			}
			return withUser(db, userId, async (tx) => {
				const [row] = await tx
					.insert(foods)
					.values({ ...columns(input), ownerId: userId, origin })
					.returning({ id: foods.id });
				await writeChildren(tx, row.id, input);
				// Saved with the food it describes, or not at all.
				if (scanEdits && origin === 'label_scan')
					await tx.insert(labelScanEdits).values({ ...scanEdits, foodId: row.id, ownerId: userId });
				return row.id;
			});
		},

		/** Totals across members of label scan edits, for admins (counts only; app_label_scan_totals()). */
		async labelScanTotals(userId: string): Promise<LabelScanTotals> {
			const rows = await withUser(db, userId, (tx) =>
				tx.execute<Record<string, string>>(sql`select * from app_label_scan_totals()`)
			);
			const r = rows[0];
			return {
				scans: Number(r.scans),
				withoutEdits: Number(r.without_edits),
				proposed: Number(r.proposed),
				changed: Number(r.changed),
				removed: Number(r.removed),
				added: Number(r.added),
				basisUnknown: Number(r.basis_unknown),
				basisChanged: Number(r.basis_changed)
			};
		},

		/** The food the person already has that is the same as this one, if any ("Already in your foods"). */
		async sameFood(userId: string, input: FoodInput): Promise<FoodSearchResult | null> {
			return withUser(db, userId, (tx) => sameFoodIn(tx, matchable(input)));
		},

		async getFood(userId: string, foodId: string): Promise<FoodDetail> {
			const food = await withUser(db, userId, (tx) => load(tx, foodId));
			if (!food) throw new CatalogError('not_found');
			return food;
		},

		/** Replaces a food's details if it is still at `expectedVersion`; returns the new version. */
		async updateFood(userId: string, foodId: string, expectedVersion: number, input: FoodInput) {
			if (!input.nutrients.some((n) => n.code === 'energy_kcal' || n.code === 'energy_kj')) {
				throw new CatalogError('energy_required');
			}
			return withUser(db, userId, async (tx) => {
				const current = await load(tx, foodId);
				if (!current) throw new CatalogError('not_found');
				if (!current.mine) throw new CatalogError('forbidden');
				// A recipe's values come from its ingredients; it is edited in the recipe editor.
				if (current.origin === 'recipe') throw new CatalogError('forbidden');
				const updated = await tx
					.update(foods)
					.set({
						...columns(input),
						version: expectedVersion + 1,
						updatedAt: now()
					})
					.where(and(eq(foods.id, foodId), eq(foods.version, expectedVersion)))
					.returning({ version: foods.version });
				if (updated.length === 0) throw new CatalogError('conflict');
				await writeChildren(tx, foodId, input);
				return updated[0].version;
			});
		},

		async setArchived(userId: string, foodId: string, archived: boolean): Promise<void> {
			await withUser(db, userId, async (tx) => {
				const current = await load(tx, foodId);
				if (!current) throw new CatalogError('not_found');
				if (!current.mine) throw new CatalogError('forbidden');
				await tx
					.update(foods)
					.set({
						archivedAt: archived ? now() : null,
						version: current.version + 1,
						updatedAt: now()
					})
					.where(eq(foods.id, foodId));
			});
		},

		/**
		 * Archives, restores, deletes or brings back the person's own foods or recipes, all or none, in one step.
		 * `ids` names them; `all` takes every one the action applies to (every archived food for Select all). Each must be
		 * in the state the action starts from (in use, archived, archived, deleted), or nothing changes. Returns the IDs
		 * changed, so the same step can be undone, and for a delete the names of recipes that used them (which keep
		 * their own copies of the values), at most three.
		 */
		async bulk(
			userId: string,
			action: FoodAction,
			target: { ids: string[] } | { all: 'food' | 'recipe' }
		): Promise<{ ids: string[]; usedIn: string[] }> {
			const from = {
				archive: and(isNull(foods.archivedAt), isNull(foods.deletedAt)),
				restore: and(sql`${foods.archivedAt} is not null`, isNull(foods.deletedAt)),
				delete: and(sql`${foods.archivedAt} is not null`, isNull(foods.deletedAt)),
				undelete: sql`${foods.deletedAt} is not null`
			}[action];
			const set = {
				archive: { archivedAt: now() },
				restore: { archivedAt: null },
				delete: { deletedAt: now() },
				undelete: { deletedAt: null }
			}[action];
			const ids = 'ids' in target ? [...new Set(target.ids)] : null;
			if (ids && (ids.length === 0 || ids.length > MAX_BULK_FOODS))
				throw new CatalogError('not_found');
			return withUser(db, userId, async (tx) => {
				const which = ids
					? inArray(foods.id, ids)
					: target && 'all' in target && target.all === 'recipe'
						? eq(foods.origin, 'recipe')
						: ne(foods.origin, 'recipe');
				const changed = await tx
					.update(foods)
					.set({ ...set, version: sql`${foods.version} + 1`, updatedAt: now() })
					.where(and(sql`${foods.ownerId} = app_current_user_id()`, which, from))
					.returning({ id: foods.id });
				if (ids && changed.length !== ids.length) throw new CatalogError('not_found');
				const changedIds = changed.map((r) => r.id);
				let usedIn: string[] = [];
				if (action === 'delete' && changedIds.length) {
					const rows = await tx
						.selectDistinct({ name: foods.name })
						.from(recipeIngredients)
						.innerJoin(foods, eq(foods.id, recipeIngredients.recipeId))
						.where(and(inArray(recipeIngredients.foodId, changedIds), isNull(foods.deletedAt)))
						.orderBy(asc(foods.name))
						.limit(3);
					usedIn = rows.map((r) => r.name);
				}
				return { ids: changedIds, usedIn };
			});
		},

		/** The person's foods and recipes in Recently deleted, most recently deleted first. */
		async trash(userId: string): Promise<DeletedFood[]> {
			return withUser(db, userId, async (tx) => {
				const rows = await tx
					.select({
						id: foods.id,
						name: foods.name,
						brand: foods.brand,
						basis: foods.basis,
						servingLabel: foods.servingLabel,
						icon: foods.icon,
						kcal: foodNutrients.value,
						origin: foods.origin,
						deletedAt: foods.deletedAt
					})
					.from(foods)
					.leftJoin(
						foodNutrients,
						and(eq(foodNutrients.foodId, foods.id), eq(foodNutrients.code, 'energy_kcal'))
					)
					.where(
						and(sql`${foods.ownerId} = app_current_user_id()`, sql`${foods.deletedAt} is not null`)
					)
					.orderBy(desc(foods.deletedAt), asc(foods.searchKey));
				return rows.map(({ origin, deletedAt, ...r }) => ({
					...r,
					mine: true,
					recipe: origin === 'recipe',
					deletedAt: deletedAt!.toISOString()
				}));
			});
		},

		/** How many of the person's foods and recipes are in Recently deleted (More's count). */
		async trashCount(userId: string): Promise<number> {
			const [row] = await withUser(db, userId, (tx) =>
				tx
					.select({ n: sql<number>`count(*)::int` })
					.from(foods)
					.where(
						and(sql`${foods.ownerId} = app_current_user_id()`, sql`${foods.deletedAt} is not null`)
					)
			);
			return row.n;
		},

		/** How many of the person's own foods came from a LoseIt import, in use and archived. */
		async importedFoods(userId: string): Promise<{ active: number; archived: number }> {
			return withUser(db, userId, async (tx) => {
				const [row] = await tx
					.select({
						active: sql<number>`count(*) filter (where ${foods.archivedAt} is null)::int`,
						archived: sql<number>`count(*) filter (where ${foods.archivedAt} is not null)::int`
					})
					.from(foods)
					.where(
						and(eq(foods.ownerId, userId), eq(foods.origin, 'loseit'), isNull(foods.deletedAt))
					);
				return row;
			});
		},

		/**
		 * Archives, or brings back, every food the person imported from LoseIt, in one step. Only their own imported
		 * foods change; diary entries keep their own snapshots. Returns how many foods changed.
		 */
		async setImportedArchived(userId: string, archived: boolean): Promise<number> {
			return withUser(db, userId, async (tx) => {
				const changed = await tx
					.update(foods)
					.set({
						archivedAt: archived ? now() : null,
						version: sql`${foods.version} + 1`,
						updatedAt: now()
					})
					.where(
						and(
							eq(foods.ownerId, userId),
							eq(foods.origin, 'loseit'),
							isNull(foods.deletedAt),
							archived ? sql`${foods.archivedAt} is null` : sql`${foods.archivedAt} is not null`
						)
					)
					.returning({ id: foods.id });
				return changed.length;
			});
		},

		/** "Make my own variant": a private copy that records which food it came from. */
		async makeVariant(userId: string, foodId: string): Promise<string> {
			return withUser(db, userId, async (tx) => {
				const source = await load(tx, foodId);
				if (!source) throw new CatalogError('not_found');
				// Only built-in foods: the person's own foods are edited instead (repeating made copy after copy).
				if (source.origin !== 'curated') throw new CatalogError('forbidden');
				const [row] = await tx
					.insert(foods)
					.values({
						name: source.name,
						brand: source.brand,
						searchKey: foodSearchKey(source.name, source.brand),
						basis: source.basis,
						servingLabel: source.servingLabel,
						servingAmount: source.servingSize?.amount ?? null,
						servingUnit: source.servingSize?.unit ?? null,
						barcode: source.barcode,
						icon: source.icon,
						ownerId: userId,
						origin: 'variant',
						derivedFrom: source.id
					})
					.returning({ id: foods.id });
				if (source.nutrients.length) {
					await tx
						.insert(foodNutrients)
						.values(source.nutrients.map((n) => ({ ...n, foodId: row.id })));
				}
				if (source.servings.length) {
					await tx.insert(foodServings).values(
						source.servings.map((s) => ({
							name: s.name,
							amount: s.amount,
							unit: s.unit,
							// A variant's portions say where they came from, like the original's.
							source: s.source,
							foodId: row.id
						}))
					);
				}
				return row.id;
			});
		},

		/**
		 * Searches visible, non-archived foods. Every word must appear (in any order), or the whole query must be
		 * similar enough to tolerate typos. Real matches come before typo-tolerant ones; within them, boosted
		 * (recent) foods come first, then the person's own foods, then built-in ones.
		 */
		/**
		 * The person's own foods and scans, alphabetically and a page at a time: those in use, or the archived ones (with
		 * `archived`, optionally narrowed by `query`). Recipes have their own list; deleted foods are in Recently deleted.
		 * `total` counts the whole list asked for, `archivedTotal` the archive (for the row that opens it).
		 */
		async ownFoods(
			userId: string,
			offset = 0,
			limit = 50,
			options: { archived?: boolean; query?: string } = {}
		): Promise<{
			foods: (FoodSearchResult & { archived: boolean })[];
			total: number;
			archivedTotal: number;
			more: boolean;
		}> {
			const archived = options.archived ?? false;
			const words = foldForSearch(options.query ?? '')
				.slice(0, 100)
				.split(' ')
				.filter(Boolean)
				.slice(0, 8);
			return withUser(db, userId, async (tx) => {
				const mine = and(
					sql`${foods.ownerId} = app_current_user_id()`,
					ne(foods.origin, 'recipe'),
					isNull(foods.deletedAt)
				);
				const own = and(
					mine,
					archived ? sql`${foods.archivedAt} is not null` : isNull(foods.archivedAt),
					// foldForSearch leaves only letters, digits and spaces, so LIKE wildcards cannot appear.
					...words.map((w) => sql`${foods.searchKey} like ${`%${w}%`}`)
				);
				const size = Math.min(Math.max(limit, 1), 100);
				const rows = await tx
					.select({
						id: foods.id,
						name: foods.name,
						brand: foods.brand,
						basis: foods.basis,
						servingLabel: foods.servingLabel,
						icon: foods.icon,
						kcal: foodNutrients.value,
						archivedAt: foods.archivedAt
					})
					.from(foods)
					.leftJoin(
						foodNutrients,
						and(eq(foodNutrients.foodId, foods.id), eq(foodNutrients.code, 'energy_kcal'))
					)
					.where(own)
					.orderBy(asc(foods.searchKey), asc(foods.id))
					.offset(Math.max(offset, 0))
					.limit(size + 1);
				const [{ total, archivedTotal }] = await tx
					.select({
						total: sql<number>`count(*) filter (where ${own})::int`,
						archivedTotal: sql<number>`count(*) filter (where ${foods.archivedAt} is not null)::int`
					})
					.from(foods)
					.where(mine);
				return {
					foods: rows.slice(0, size).map(({ archivedAt, ...r }) => ({
						...r,
						mine: true,
						archived: archivedAt !== null
					})),
					total,
					archivedTotal,
					more: rows.length > size
				};
			});
		},

		async searchFoods(
			userId: string,
			query: string,
			limit = 20,
			/** Foods to rank first among real matches, e.g. the person's recent foods. */
			boostIds: string[] = []
		): Promise<
			(FoodSearchResult & {
				/** Every word matched (not only a typo-tolerant match). */ whole: boolean;
			})[]
		> {
			const q = foldForSearch(query).slice(0, 100);
			if (!q) return [];
			const words = q.split(' ').filter(Boolean).slice(0, 8);
			// foldForSearch leaves only letters, digits and spaces, so LIKE wildcards cannot appear in q.
			const rank = sql`case
				when ${foods.searchKey} = ${q} then 0
				when ${foods.searchKey} like ${`${q}%`} then 1
				when ${foods.searchKey} like ${`% ${q}%`} then 2
				when ${foods.searchKey} like ${`%${q}%`} then 3
				else 4 end`;
			const allWords = sql.join(
				words.map((w) => sql`${foods.searchKey} like ${`%${w}%`}`),
				sql` and `
			);
			const rows = await withUser(db, userId, (tx) =>
				tx
					.select({
						id: foods.id,
						name: foods.name,
						brand: foods.brand,
						basis: foods.basis,
						servingLabel: foods.servingLabel,
						icon: foods.icon,
						mine: sql<boolean>`${foods.ownerId} = app_current_user_id()`,
						curated: sql<boolean>`${foods.origin} = 'curated'`,
						kcal: foodNutrients.value,
						whole: sql<boolean>`(${allWords})`
					})
					.from(foods)
					.leftJoin(
						foodNutrients,
						and(eq(foodNutrients.foodId, foods.id), eq(foodNutrients.code, 'energy_kcal'))
					)
					.where(
						and(sql`${foods.archivedAt} is null`, sql`((${allWords}) or ${foods.searchKey} % ${q})`)
					)
					.orderBy(
						// Real matches before typo-tolerant ones; then boosted (recent), own, and built-in foods.
						sql`(${rank} < 4) desc`,
						...(boostIds.length
							? [
									sql`(${foods.id} in (${sql.join(
										boostIds.slice(0, 50).map((id) => sql`${id}::uuid`),
										sql`, `
									)})) desc`
								]
							: []),
						sql`(${foods.ownerId} = app_current_user_id()) desc nulls last`,
						rank,
						sql`similarity(${foods.searchKey}, ${q}) desc`,
						asc(foods.name)
					)
					.limit(Math.min(Math.max(limit, 1), 50))
			);
			return rows.map((r) => ({
				...r,
				mine: Boolean(r.mine),
				curated: Boolean(r.curated),
				whole: Boolean(r.whole)
			}));
		},

		/**
		 * Search for words taken from a sentence, which may carry extra words ("SEK protein süt after gym"). A match
		 * on every word wins; otherwise the longest run of consecutive words that every word of matches, so extra words
		 * never turn a real match into a typo match. Falls back to the typo-tolerant results.
		 */
		async searchFoodsLoose(
			userId: string,
			text: string,
			limit = 5,
			boostIds: string[] = []
		): Promise<FoodSearchResult[]> {
			const strip = (rows: (FoodSearchResult & { whole: boolean })[]): FoodSearchResult[] =>
				rows.map((r) => ({
					id: r.id,
					name: r.name,
					brand: r.brand,
					basis: r.basis,
					servingLabel: r.servingLabel,
					mine: r.mine,
					kcal: r.kcal,
					icon: r.icon,
					curated: r.curated,
					loose: !r.whole
				}));
			const full = await this.searchFoods(userId, text, limit, boostIds);
			if (full[0]?.whole) return strip(full);
			const words = foldForSearch(text).split(' ').filter(Boolean).slice(0, 8);
			let tries = 0;
			for (let size = words.length - 1; size >= 1; size--) {
				for (let start = 0; start + size <= words.length; start++) {
					if (++tries > 12) return strip(full);
					const part = await this.searchFoods(
						userId,
						words.slice(start, start + size).join(' '),
						limit,
						boostIds
					);
					// Some of the words were ignored: a food may have been lost, so it counts as loose too.
					if (part[0]?.whole) return strip(part).map((r) => ({ ...r, loose: true }));
				}
			}
			return strip(full);
		},

		/** Shared reference data; no personal rows, so no identity is needed. */
		async householdMeasures() {
			return db.select().from(householdMeasures).orderBy(asc(householdMeasures.position));
		},

		async foodsById(userId: string, ids: string[]): Promise<FoodDetail[]> {
			if (!ids.length) return [];
			return withUser(db, userId, async (tx) => {
				const rows = await tx
					.select({
						food: foods,
						mine: sql<boolean>`${foods.ownerId} = app_current_user_id()`
					})
					.from(foods)
					.where(and(inArray(foods.id, ids), isNull(foods.deletedAt)));
				const nutrients = await tx
					.select({
						foodId: foodNutrients.foodId,
						code: foodNutrients.code,
						value: foodNutrients.value,
						qualifier: foodNutrients.qualifier
					})
					.from(foodNutrients)
					.where(inArray(foodNutrients.foodId, ids));
				const servings = await tx
					.select({
						foodId: foodServings.foodId,
						id: foodServings.id,
						name: foodServings.name,
						amount: foodServings.amount,
						unit: foodServings.unit,
						source: foodServings.source
					})
					.from(foodServings)
					.where(inArray(foodServings.foodId, ids))
					.orderBy(asc(foodServings.amount));
				return rows.map((row) =>
					toDetail(
						row,
						nutrients
							.filter((n) => n.foodId === row.food.id)
							.map(({ code, value, qualifier }) => ({ code, value, qualifier })) as NutrientValue[],
						servings
							.filter((s) => s.foodId === row.food.id)
							.map(({ id, name, amount, unit, source }) => ({ id, name, amount, unit, source }))
					)
				);
			});
		}
	};
}

export type Catalog = ReturnType<typeof createCatalog>;
