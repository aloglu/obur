// Household measures change rarely; fetch once per page load.
import type { MeasureOption } from '#lib/shared/unit-options.ts';
import { api } from './api.ts';

let cached: Promise<MeasureOption[]> | undefined;

/**
 * The household measures, or none while the server can't be reached; a failed fetch is not kept, so the next call
 * tries again (it once stayed failed until the page was reloaded).
 */
export function householdMeasures(): Promise<MeasureOption[]> {
	cached ??= api<{ measures: MeasureOption[] }>('GET', '/api/v1/measures')
		.then((r) => r.measures)
		.catch(() => {
			cached = undefined;
			return [];
		});
	return cached;
}
