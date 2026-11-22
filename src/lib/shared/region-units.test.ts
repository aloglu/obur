import { describe, expect, it } from 'vitest';
import { regionUnits } from './region-units.ts';

describe('the units a new account starts with', () => {
	it('follow the phone region', () => {
		expect(regionUnits('en-US,en;q=0.9')).toEqual({
			weightUnit: 'lb',
			lengthUnit: 'in',
			waterUnit: 'floz'
		});
		expect(regionUnits('en-GB')).toEqual({ weightUnit: 'kg', lengthUnit: 'in', waterUnit: 'ml' });
		expect(regionUnits('ga-IE,en-IE;q=0.8')).toMatchObject({ lengthUnit: 'in', weightUnit: 'kg' });
		expect(regionUnits('zh-Hant-US')).toMatchObject({ weightUnit: 'lb' });
	});
	it('are metric elsewhere, or with no region', () => {
		const metric = { weightUnit: 'kg', lengthUnit: 'cm', waterUnit: 'ml' };
		expect(regionUnits('tr-TR,tr;q=0.9')).toEqual(metric);
		expect(regionUnits('en-AU')).toEqual(metric);
		expect(regionUnits('en')).toEqual(metric);
		expect(regionUnits(null)).toEqual(metric);
		// The first tag with a region decides.
		expect(regionUnits('en, de-DE, en-US')).toEqual(metric);
	});
});
