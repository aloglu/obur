// Food search on the device, from the service worker's copy of the person's foods, for when the server can't be
// reached (docs/design.md, "Offline scope"). The same matching and order as the server's search
// (catalog/service.ts, searchFoods) except typo tolerance, which needs the database.
import type { FoodDetail, FoodSearchResult } from './food-types.ts';
import { foldForSearch, foodSearchKey } from './search-text.ts';

export interface SearchableFood {
	food: FoodDetail;
	key: string;
}

/** A food in the copy, with the server's search text (a built-in food's aliases are only there). */
export type OfflineFood = FoodDetail & { searchKey?: string };

/** Prepares a copy once, so each search only compares strings. */
export function searchable(foods: OfflineFood[]): SearchableFood[] {
	return foods.map(({ searchKey, ...food }) => ({
		food,
		key: searchKey ?? foodSearchKey(food.name, food.brand)
	}));
}

export function searchLocal(
	foods: SearchableFood[],
	query: string,
	limit = 20,
	/** Foods to rank first among real matches, e.g. the person's recent foods. */
	boostIds: string[] = []
): FoodSearchResult[] {
	const q = foldForSearch(query).slice(0, 100);
	if (!q) return [];
	const words = q.split(' ').filter(Boolean).slice(0, 8);
	const boosted = new Set(boostIds.slice(0, 50));
	const rank = (key: string) =>
		key === q ? 0 : key.startsWith(q) ? 1 : key.includes(` ${q}`) ? 2 : key.includes(q) ? 3 : 4;
	const order = (f: SearchableFood & { rank: number }) => [
		f.rank < 4 ? 0 : 1,
		boosted.has(f.food.id) ? 0 : 1,
		f.food.mine ? 0 : 1,
		f.rank
	];
	return foods
		.filter((f) => words.every((w) => f.key.includes(w)))
		.map((f) => ({ ...f, rank: rank(f.key) }))
		.sort((a, b) => {
			const [x, y] = [order(a), order(b)];
			for (let i = 0; i < x.length; i++) if (x[i] !== y[i]) return x[i] - y[i];
			return a.food.name < b.food.name ? -1 : a.food.name > b.food.name ? 1 : 0;
		})
		.slice(0, Math.min(Math.max(limit, 1), 50))
		.map(({ food: f }) => ({
			id: f.id,
			name: f.name,
			brand: f.brand,
			basis: f.basis,
			servingLabel: f.servingLabel,
			mine: f.mine,
			kcal: f.nutrients.find((n) => n.code === 'energy_kcal')?.value ?? null,
			icon: f.icon,
			curated: f.origin === 'curated'
		}));
}

/** The person's foods in full, as the service worker fetches them for its copy (routes/api/v1/foods/offline). */
export const FOOD_COPY_PATH = '/api/v1/foods/offline';
/** Answered by the service worker alone, from its copy: `?q=` and `&boost=` (IDs, comma-separated). */
export const LOCAL_SEARCH_PATH = '/__offline/foods';
/** Writes that can change the copy (foods, recipes, imports); it is checked again a moment after one. */
export const CHANGES_FOODS = /^\/api\/v1\/(foods|recipes|import)(\/|$)/;
