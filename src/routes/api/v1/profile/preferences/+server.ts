import { json } from '@sveltejs/kit';
import { goals } from '#lib/server/goals.ts';
import { readJson } from '#lib/server/http.ts';
import { PreferencesInput } from '#lib/shared/preferences.ts';
import type { RequestHandler } from './$types';

/** PATCH any of the settings (shared/preferences.ts): kept with the account, on every device and in the backup. */
export const PATCH: RequestHandler = async ({ request, locals }) => {
	const input = await readJson(request, PreferencesInput);
	return json({ preferences: await goals.savePreferences(locals.session!.userId, input) });
};
