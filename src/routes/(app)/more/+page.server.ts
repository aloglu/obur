import { diary } from '#lib/server/diary.ts';
import { goals } from '#lib/server/goals.ts';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals, parent }) => {
	const { today } = await parent();
	const userId = locals.session!.userId;
	const [deleted, target] = await Promise.all([
		diary.trash(userId),
		goals.targetFor(userId, today)
	]);
	const requested = target?.inputs.requestedRateKgPerWeek;
	return {
		deletedCount: deleted.length,
		/** The pace a calculated budget asks for, for the Goal row. */
		goal:
			target?.mode === 'calculated'
				? typeof requested === 'number'
					? requested
					: (target.rateKgPerWeek ?? 0)
				: null
	};
};
