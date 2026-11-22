import { json } from '@sveltejs/kit';
import { goals } from '#lib/server/goals.ts';
import type { RequestHandler } from './$types';

// Read only. Details are saved through PATCH /api/v1/profile/details, which ends a calculated budget where none is
// allowed (pregnancy, breastfeeding, under 18); a second way to write them skipped that (2026-11-22 Gemini audit,
// G25), and the app never used it.
export const GET: RequestHandler = async ({ locals }) =>
	json({ profile: await goals.profile(locals.session!.userId) });
