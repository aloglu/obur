// Food catalog operations, all under the signed-in person's identity (RLS decides visibility and edit rights).
// Shared foods never expose who created them (docs/design.md, "Food catalog and recipes").
import { and, asc, eq, inArray, sql } from 'drizzle-orm';
import { withUser, type Database, type Tx } from '../../db/identity.ts';
import { foodWarnings } from '../../../shared/food-checks.ts';
import type { FoodInput } from '../../../shared/food-input.ts';
import { deriveNutrients, type NutrientValue } from '../../../shared/nutrients.ts';
import type { FoodDetail, FoodSearchResult } from '../../../shared/food-types.ts';
import { foldForSearch, foodSearchKey, searchKeyWithAliases } from '../../../shared/search-text.ts';
import type { ScanEdits } from '../../../shared/scan-edits.ts';
import { foodNutrients, foods, foodServings, householdMeasures, labelScanEdits } from './schema.ts';

/** Household totals of label scans saved with edit counts (counts only). */
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
	await tx.delete(foodServings).where(eq(foodServings.foodId, foodId));
	if (input.servings.length) {
		await tx.insert(foodServings).values(input.servings.map((s) => ({ ...s, foodId })));
	}
}

const columns = (input: FoodInput) => ({
	name: input.name,
	brand: input.brand,
	searchKey: foodSearchKey(input.name, input.brand),
	visibility: input.visibility,
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
			mine: sql<boolean>`${foods.ownerId} = app_current_user_id()`,
			editable: sql<boolean>`(${foods.ownerId} = app_current_user_id()
				or (${foods.visibility} = 'shared' and app_current_user_is_admin()))`
		})
		.from(foods)
		.where(eq(foods.id, foodId));
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
	const f = row.food;
	const values = nutrients as NutrientValue[];
	return {
		id: f.id,
		name: f.name,
		brand: f.brand,
		visibility: f.visibility,
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
		editable: Boolean(row.editable),
		derivedFrom: f.derivedFrom,
		nutrients: values,
		servings,
		warnings: foodWarnings(f.basis, values)
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

		/** Household totals of label scan edits, for admins (counts only; app_label_scan_totals()). */
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
				if (!current.editable) throw new CatalogError('forbidden');
				// A recipe's values come from its ingredients; it is edited in the recipe editor.
				if (current.origin === 'recipe') throw new CatalogError('forbidden');
				// Only the creator may change who can see a food.
				if (!current.mine && input.visibility !== current.visibility)
					throw new CatalogError('forbidden');
				// An edit keeps a curated food's aliases searchable.
				const [{ meta }] = await tx
					.select({ meta: foods.sourceMeta })
					.from(foods)
					.where(eq(foods.id, foodId));
				const updated = await tx
					.update(foods)
					.set({
						...columns(input),
						searchKey: searchKeyWithAliases(input.name, input.brand, meta),
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
				if (!current.editable) throw new CatalogError('forbidden');
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

		/** "Make my own variant": a private copy that records which food it came from. */
		async makeVariant(userId: string, foodId: string): Promise<string> {
			return withUser(db, userId, async (tx) => {
				const source = await load(tx, foodId);
				if (!source) throw new CatalogError('not_found');
				const [row] = await tx
					.insert(foods)
					.values({
						name: source.name,
						brand: source.brand,
						searchKey: foodSearchKey(source.name, source.brand),
						visibility: 'private',
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
		 * (recent) foods come first, then the person's own foods, then shared ones.
		 */
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
						visibility: foods.visibility,
						mine: sql<boolean>`${foods.ownerId} = app_current_user_id()`,
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
						// Real matches before typo-tolerant ones; then boosted (recent), own, and shared foods.
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
			return rows.map((r) => ({ ...r, mine: Boolean(r.mine), whole: Boolean(r.whole) }));
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
					visibility: r.visibility,
					mine: r.mine,
					kcal: r.kcal,
					icon: r.icon,
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
				const visible = await tx.select({ id: foods.id }).from(foods).where(inArray(foods.id, ids));
				const out: FoodDetail[] = [];
				for (const { id } of visible) {
					const food = await load(tx, id);
					if (food) out.push(food);
				}
				return out;
			});
		}
	};
}

export type Catalog = ReturnType<typeof createCatalog>;
