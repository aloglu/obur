// A profile saved directly, for database tests' setup only (never in the image: tests/ is not copied). The app saves
// profiles through goals.updateDetails and savePreferences, which apply the rules for minors, pregnancy and
// breastfeeding; this does not (2026-11-25 Review.md audit, 4.2: it was a service method no route used).
import type postgres from 'postgres';
import * as v from 'valibot';
import { isIsoDate } from '../../src/lib/shared/diary-rules.ts';

const optionalNumber = (min: number, max: number) =>
	v.optional(v.nullable(v.pipe(v.number(), v.finite(), v.minValue(min), v.maxValue(max))), null);

const ProfileFixture = v.object({
	heightCm: optionalNumber(50, 260),
	birthDate: v.optional(v.nullable(v.pipe(v.string(), v.check(isIsoDate, 'Invalid date'))), null),
	sex: v.optional(v.nullable(v.picklist(['female', 'male'])), null),
	bodyFatPct: optionalNumber(2, 75),
	waistCm: optionalNumber(30, 250),
	pregnant: v.optional(v.boolean(), false),
	breastfeeding: v.optional(v.boolean(), false),
	decimalMark: v.optional(v.picklist([',', '.']), ','),
	firstDayOfWeek: v.optional(v.pipe(v.number(), v.integer(), v.minValue(1), v.maxValue(7)), 1)
});

/**
 * Saves a profile as the database's owner would (missing optional fields take their defaults). Plain SQL: wrapping the
 * test's own connection in Drizzle would change how it reads dates for the rest of the test.
 */
export async function saveProfile(
	sql: postgres.Sql,
	userId: string,
	raw: v.InferInput<typeof ProfileFixture>
): Promise<void> {
	const p = v.parse(ProfileFixture, raw);
	const set = {
		height_cm: p.heightCm,
		birth_date: p.birthDate,
		sex: p.sex,
		body_fat_pct: p.bodyFatPct,
		waist_cm: p.waistCm,
		pregnant: p.pregnant,
		breastfeeding: p.breastfeeding,
		decimal_mark: p.decimalMark,
		first_day_of_week: p.firstDayOfWeek,
		updated_at: new Date()
	};
	await sql`insert into profiles ${sql({ user_id: userId, ...set })}
		on conflict (user_id) do update set ${sql(set)}`;
}
