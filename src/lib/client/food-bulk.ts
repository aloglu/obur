// Archive, restore, delete or bring back foods and recipes by ID, any number of them: a long list goes in parts
// (shared/food-bulk.ts). Each part is all or none; the parts run in order and stop at the first refusal.
import { api } from './api.ts';
import { bulkParts, type FoodAction } from '#lib/shared/food-bulk.ts';

export async function bulkFoods(
	action: FoodAction,
	ids: string[]
): Promise<{ ids: string[]; usedIn: string[] }> {
	const out = { ids: [] as string[], usedIn: [] as string[] };
	for (const part of bulkParts(ids)) {
		const r = await api<{ ids: string[]; usedIn: string[] }>('POST', '/api/v1/foods/bulk', {
			action,
			ids: part
		});
		out.ids.push(...r.ids);
		for (const name of r.usedIn)
			if (out.usedIn.length < 3 && !out.usedIn.includes(name)) out.usedIn.push(name);
	}
	return out;
}
