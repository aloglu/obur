import { json } from '@sveltejs/kit';
import { goals } from '#lib/server/goals.ts';
import { readJson } from '#lib/server/http.ts';
import { ProfileInput } from '#lib/shared/goal-types.ts';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ locals }) =>
	json({ profile: await goals.profile(locals.session!.userId) });

export const PUT: RequestHandler = async ({ request, locals }) => {
	const input = await readJson(request, ProfileInput);
	return json({ profile: await goals.saveProfile(locals.session!.userId, input) });
};
