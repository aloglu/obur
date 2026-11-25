// Bulk actions on foods and recipes (docs/design.md, "Archived and deleted foods"). A request names at most
// MAX_BULK_FOODS by ID; longer lists (Undo after Select all on a big archive, Restore in Recently deleted) go in parts.
// Select all itself names no IDs, so it has no limit.
// 1,000 IDs are about 39 KB of JSON, inside the server's 64 KB limit for a body (5,000 were refused: 2026-11-25
// Review.md audit, 1.2).
export const MAX_BULK_FOODS = 1000;

export type FoodAction = 'archive' | 'restore' | 'delete' | 'undelete';

/** Splits IDs into the parts one request takes. */
export function bulkParts(ids: string[]): string[][] {
	const parts: string[][] = [];
	for (let i = 0; i < ids.length; i += MAX_BULK_FOODS) parts.push(ids.slice(i, i + MAX_BULK_FOODS));
	return parts;
}
