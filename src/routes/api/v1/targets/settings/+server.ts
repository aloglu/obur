import { json } from '@sveltejs/kit';
import { body } from '#lib/server/body.ts';
import { goals, respondGoals } from '#lib/server/goals.ts';
import { readJson } from '#lib/server/http.ts';
import { localDate } from '#lib/shared/diary-rules.ts';
import { BudgetSettingsInput } from '#lib/shared/goal-types.ts';
import type { RequestHandler } from './$types';

/** PATCH { countActivity?, atGoal? }: changes the budget settings from today on; earlier days keep theirs. */
export const PATCH: RequestHandler = ({ request, locals }) =>
	respondGoals(async () => {
		const userId = locals.session!.userId;
		const change = await readJson(request, BudgetSettingsInput);
		const today = localDate(new Date(), locals.zone);
		const weight = await body.latestWeight(userId, today);
		return json({
			target: await goals.changeSettings(userId, today, weight?.value ?? null, change)
		});
	});
