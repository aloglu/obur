// Whether a profile row holds details the person entered (setup's About you), or only settings: a new account's
// first page saves the browser's and the place's choices on the same row (2026-11-22 audit, A04). Imports treat a
// settings-only row as no profile, so a migration still brings the birth date, height and sex.
import type { profiles } from './schema.ts';

type Row = Pick<
	typeof profiles.$inferSelect,
	'heightCm' | 'birthDate' | 'sex' | 'bodyFatPct' | 'waistCm'
>;

export const hasProfileDetails = (row: Row | null | undefined): boolean =>
	!!row &&
	(row.heightCm !== null ||
		row.birthDate !== null ||
		row.sex !== null ||
		row.bodyFatPct !== null ||
		row.waistCm !== null);
