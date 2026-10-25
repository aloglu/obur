// Household measures change rarely; fetch once per page load.
import type { MeasureOption } from '#lib/shared/unit-options.ts';
import { api } from './api.ts';

let cached: Promise<MeasureOption[]> | undefined;

export function householdMeasures(): Promise<MeasureOption[]> {
	cached ??= api<{ measures: MeasureOption[] }>('GET', '/api/v1/measures').then((r) => r.measures);
	return cached;
}
