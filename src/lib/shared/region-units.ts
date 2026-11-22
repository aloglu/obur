// The units a new account starts with, from the phone's region in its language list ("en-US", "en-GB"; owner,
// 2026-11-22): the United States uses pounds, feet and inches, and US fluid ounces; the United Kingdom and Ireland feet
// and inches with kilograms and millilitres; everywhere else is metric. Each field on setup can change them.
import type { Preferences } from './preferences.ts';

type Units = Pick<Preferences, 'weightUnit' | 'lengthUnit' | 'waterUnit'>;

const METRIC: Units = { weightUnit: 'kg', lengthUnit: 'cm', waterUnit: 'ml' };
const BY_REGION: Record<string, Units> = {
	US: { weightUnit: 'lb', lengthUnit: 'in', waterUnit: 'floz' },
	GB: { weightUnit: 'kg', lengthUnit: 'in', waterUnit: 'ml' },
	IE: { weightUnit: 'kg', lengthUnit: 'in', waterUnit: 'ml' }
};

/** The first language in an Accept-Language header that names a region decides; none is metric. */
export function regionUnits(acceptLanguage: string | null): Units {
	for (const part of (acceptLanguage ?? '').split(',')) {
		const tag = part.split(';')[0].trim();
		const region = /^[a-z]{2,3}(?:-[A-Za-z]{4})?-([A-Za-z]{2})\b/i.exec(tag)?.[1]?.toUpperCase();
		if (region) return BY_REGION[region] ?? METRIC;
	}
	return METRIC;
}
