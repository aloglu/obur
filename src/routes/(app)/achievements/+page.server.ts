import { progress } from '#lib/server/progress.ts';
import { nextUp } from '#lib/shared/achievements.ts';
import { localDate } from '#lib/shared/diary-rules.ts';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals }) => {
	// Worked out here rather than taken from the layout: the layout's data refreshes on its own, and a page that
	// read it would be loaded again with it.
	const today = localDate(new Date(), locals.zone);
	const { list, weightAllowed } = await progress.sync(locals.session!.userId, today, locals.zone);
	return { achievements: list, next: nextUp(list), weightAllowed };
};
