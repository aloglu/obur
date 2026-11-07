import { json } from '@sveltejs/kit';
import { body } from '#lib/server/body.ts';
import { goals, respondGoals } from '#lib/server/goals.ts';
import { readJson } from '#lib/server/http.ts';
import { localDate } from '#lib/shared/diary-rules.ts';
import { ProfileDetailsInput } from '#lib/shared/goal-types.ts';
import type { RequestHandler } from './$types';

/**
 * PATCH { heightCm, birthDate, sex, goalWeightKg?, bodyFatPct?, waistCm?, pregnant?, breastfeeding? }: saves the
 * details from setup's "About you" (also reached from Profile's rows); a calculated budget follows them from today on
 * (the reply's `outcome` says how). A new weight is a weigh-in, saved through the body routes.
 */
export const PATCH: RequestHandler = ({ request, locals }) =>
	respondGoals(async () => {
		const userId = locals.session!.userId;
		const input = await readJson(request, ProfileDetailsInput);
		const today = localDate(new Date(), locals.zone);
		const weight = await body.latestWeight(userId, today);
		return json(await goals.updateDetails(userId, today, weight?.value ?? null, input));
	});
