// The application's goals instance and its HTTP error mapping.
import { json } from '@sveltejs/kit';
import { createGoals, GoalError, type BudgetChange } from '#lib/server/modules/goals/index.ts';
import { localDate } from '#lib/shared/diary-rules.ts';
import { body } from './body.ts';
import { db } from './db/index.ts';

export const goals = createGoals(db);

/**
 * After a weight is added, removed or restored: moves a calculated budget to the latest weight from today on.
 * Runs after the weight's own transaction; a failure here leaves the weight saved and the next weight change
 * catches the budget up, so it never fails the request.
 */
export async function followLatestWeight(
	userId: string,
	zone: string
): Promise<BudgetChange | null> {
	try {
		const today = localDate(new Date(), zone);
		const latest = await body.latestWeight(userId, today);
		return await goals.followWeight(userId, today, latest?.value ?? null);
	} catch (e) {
		console.error('Budget recalculation after a weight change failed', (e as Error).name);
		return null;
	}
}

export async function respondGoals(run: () => Promise<Response>): Promise<Response> {
	try {
		return await run();
	} catch (e) {
		if (e instanceof GoalError) return json({ error: e.code }, { status: 422 });
		throw e;
	}
}

/** The budget numbers for a confirmation, only when the day's budget actually moved (not just macros). */
export const budgetNote = (change: BudgetChange | null) =>
	change && change.afterKcal !== change.beforeKcal
		? { beforeKcal: change.beforeKcal, afterKcal: change.afterKcal }
		: null;
