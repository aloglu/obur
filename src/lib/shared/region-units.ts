// The units a new account starts with, from the device's time zone (owner, 2026-11-22; audit D01: the language list
// names a language variant, not a place, and "en-US" is common far from the US). The United States uses pounds, feet
// and inches, and US fluid ounces; the United Kingdom and Ireland feet and inches with kilograms and millilitres;
// everywhere else, and an unknown zone, is metric. Each field on setup can change them.
import type { Preferences } from './preferences.ts';

type Units = Pick<Preferences, 'weightUnit' | 'lengthUnit' | 'waterUnit'>;

const METRIC: Units = { weightUnit: 'kg', lengthUnit: 'cm', waterUnit: 'ml' };
const US: Units = { weightUnit: 'lb', lengthUnit: 'in', waterUnit: 'floz' };
const UK: Units = { weightUnit: 'kg', lengthUnit: 'in', waterUnit: 'ml' };

/** The 50 states' zones (IANA, with their old names); territories are left metric. */
const US_ZONES = new Set([
	'America/New_York',
	'America/Detroit',
	'America/Kentucky/Louisville',
	'America/Kentucky/Monticello',
	'America/Louisville',
	'America/Indiana/Indianapolis',
	'America/Indiana/Vincennes',
	'America/Indiana/Winamac',
	'America/Indiana/Marengo',
	'America/Indiana/Petersburg',
	'America/Indiana/Vevay',
	'America/Indiana/Tell_City',
	'America/Indiana/Knox',
	'America/Indianapolis',
	'America/Chicago',
	'America/Menominee',
	'America/North_Dakota/Center',
	'America/North_Dakota/New_Salem',
	'America/North_Dakota/Beulah',
	'America/Denver',
	'America/Boise',
	'America/Phoenix',
	'America/Los_Angeles',
	'America/Anchorage',
	'America/Juneau',
	'America/Sitka',
	'America/Metlakatla',
	'America/Yakutat',
	'America/Nome',
	'America/Adak',
	'Pacific/Honolulu',
	'US/Eastern',
	'US/Central',
	'US/Mountain',
	'US/Pacific',
	'US/Arizona',
	'US/Alaska',
	'US/Hawaii',
	'US/Michigan',
	'US/East-Indiana',
	'US/Indiana-Starke',
	'US/Aleutian'
]);
const UK_ZONES = new Set([
	'Europe/London',
	'Europe/Belfast',
	'GB',
	'GB-Eire',
	'Europe/Dublin',
	'Eire'
]);

export function regionUnits(zone: string | null | undefined): Units {
	if (zone && US_ZONES.has(zone)) return US;
	if (zone && UK_ZONES.has(zone)) return UK;
	return METRIC;
}
