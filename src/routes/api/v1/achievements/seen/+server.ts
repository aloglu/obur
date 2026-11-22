import { json } from '@sveltejs/kit';
import * as v from 'valibot';
import { readJson } from '#lib/server/http.ts';
import { progress } from '#lib/server/progress.ts';
import { isAchievementKey } from '#lib/shared/achievements.ts';
import type { RequestHandler } from './$types';

const SeenInput = v.object({
	keys: v.pipe(v.array(v.pipe(v.string(), v.check(isAchievementKey))), v.maxLength(100))
});

/** POST the achievements just celebrated (or dismissed), so they are not celebrated again. */
export const POST: RequestHandler = async ({ request, locals }) => {
	const { keys } = await readJson(request, SeenInput);
	await progress.markSeen(locals.session!.userId, keys);
	return json({ ok: true });
};
