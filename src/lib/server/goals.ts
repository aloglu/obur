// The application's goals instance and its HTTP error mapping.
import { json } from '@sveltejs/kit';
import { createGoals, GoalError } from '#lib/server/modules/goals/index.ts';
import { db } from './db/index.ts';

export const goals = createGoals(db);

export async function respondGoals(run: () => Promise<Response>): Promise<Response> {
	try {
		return await run();
	} catch (e) {
		if (e instanceof GoalError) return json({ error: e.code }, { status: 422 });
		throw e;
	}
}
