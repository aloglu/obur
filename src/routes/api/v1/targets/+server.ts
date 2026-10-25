import { error, json } from '@sveltejs/kit';
import { body } from '#lib/server/body.ts';
import { goals, respondGoals } from '#lib/server/goals.ts';
import { readJson } from '#lib/server/http.ts';
import { isIsoDate } from '#lib/shared/diary-rules.ts';
import { TargetInput } from '#lib/shared/goal-types.ts';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ url, locals }) => {
	const date = url.searchParams.get('date') ?? '';
	if (!isIsoDate(date)) error(400, 'Invalid date');
	return json({ target: await goals.targetFor(locals.session!.userId, date) });
};

/** Records a new target version; a calculated one uses the latest weigh-in on or before its effective date. */
export const POST: RequestHandler = ({ request, locals }) =>
	respondGoals(async () => {
		const userId = locals.session!.userId;
		const input = await readJson(request, TargetInput);
		const weight = await body.latestWeight(userId, input.effectiveFrom);
		return json(
			{ target: await goals.setTarget(userId, input, weight?.value ?? null) },
			{ status: 201 }
		);
	});
