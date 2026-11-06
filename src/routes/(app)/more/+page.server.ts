import { diary } from '#lib/server/diary.ts';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals }) => ({
	deletedCount: (await diary.trash(locals.session!.userId)).length
});
