import { body } from '#lib/server/body.ts';
import { goals } from '#lib/server/goals.ts';
import { goalWeightAllowed } from '#lib/shared/goals.ts';
import { localDate } from '#lib/shared/diary-rules.ts';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals }) => {
	// Worked out here rather than taken from the layout: the layout's data refreshes on its own, and a page that
	// read it would be loaded again with it.
	const today = localDate(new Date(), locals.zone);
	const userId = locals.session!.userId;
	const [target, latestWeight, profile] = await Promise.all([
		goals.targetFor(userId, today),
		body.latestWeight(userId, today),
		goals.profile(userId)
	]);
	return { target, latestWeight, goalAllowed: goalWeightAllowed(profile, today) };
};
