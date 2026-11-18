// Bulk actions on foods and recipes (docs/design.md, "Archived and deleted foods"). A request names at most
// MAX_BULK_FOODS by ID; longer lists (Undo after Select all on a big archive, Restore in Recently deleted) go in parts.
// Select all itself names no IDs, so it has no limit.
export const MAX_BULK_FOODS = 5000;

export type FoodAction = 'archive' | 'restore' | 'delete' | 'undelete';

/** Splits IDs into the parts one request takes. */
export function bulkParts(ids: string[]): string[][] {
	const parts: string[][] = [];
	for (let i = 0; i < ids.length; i += MAX_BULK_FOODS) parts.push(ids.slice(i, i + MAX_BULK_FOODS));
	return parts;
}
