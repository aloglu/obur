import { goals } from '#lib/server/goals.ts';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals, parent }) => {
	const { today } = await parent();
	const target = await goals.targetFor(locals.session!.userId, today);
	const requested = target?.inputs.requestedRateKgPerWeek;
	return {
		/** The pace a calculated budget asks for, for the Goal row. */
		goal:
			target?.mode === 'calculated'
				? typeof requested === 'number'
					? requested
					: (target.rateKgPerWeek ?? 0)
				: null
	};
};
