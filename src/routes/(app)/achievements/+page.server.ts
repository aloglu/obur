import { progress } from '#lib/server/progress.ts';
import { nextUp } from '#lib/shared/achievements.ts';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals, parent }) => {
	const { today } = await parent();
	const { list, weightAllowed } = await progress.sync(locals.session!.userId, today, locals.zone);
	return { achievements: list, next: nextUp(list), weightAllowed };
};
