import { describe, expect, it } from 'vitest';
import { regionUnits } from './region-units.ts';

describe('the units a new account starts with', () => {
	it('follow where the device is', () => {
		const us = { weightUnit: 'lb', lengthUnit: 'in', waterUnit: 'floz' };
		for (const zone of [
			'America/New_York',
			'America/Chicago',
			'America/Phoenix',
			'Pacific/Honolulu'
		])
			expect(regionUnits(zone)).toEqual(us);
		const uk = { weightUnit: 'kg', lengthUnit: 'in', waterUnit: 'ml' };
		expect(regionUnits('Europe/London')).toEqual(uk);
		expect(regionUnits('Europe/Dublin')).toEqual(uk);
	});
	it('are metric elsewhere, also next door to the US, and when the zone is unknown', () => {
		const metric = { weightUnit: 'kg', lengthUnit: 'cm', waterUnit: 'ml' };
		for (const zone of [
			'Europe/Istanbul',
			'America/Toronto',
			'America/Mexico_City',
			'Australia/Sydney',
			'UTC'
		])
			expect(regionUnits(zone)).toEqual(metric);
		expect(regionUnits(null)).toEqual(metric);
	});
});
