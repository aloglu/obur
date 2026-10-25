import { body } from '#lib/server/body.ts';
import { goals } from '#lib/server/goals.ts';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals, parent }) => {
	const { today } = await parent();
	const userId = locals.session!.userId;
	const [profile, latestWeight] = await Promise.all([
		goals.profile(userId),
		body.latestWeight(userId, today)
	]);
	return { profile, latestWeight };
};
