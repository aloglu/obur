import { describe, expect, it } from 'vitest';
import { bulkParts, MAX_BULK_FOODS } from './food-bulk.ts';

describe('bulk food requests', () => {
	it('sends a long list of IDs in parts no request refuses, keeping every ID once', () => {
		const ids = Array.from({ length: MAX_BULK_FOODS * 2 + 1 }, (_, i) => `id-${i}`);
		const parts = bulkParts(ids);
		expect(parts.map((p) => p.length)).toEqual([MAX_BULK_FOODS, MAX_BULK_FOODS, 1]);
		expect(parts.flat()).toEqual(ids);
		expect(bulkParts([])).toEqual([]);
	});
});
