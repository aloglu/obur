import { error, json } from '@sveltejs/kit';
import { config } from '#lib/server/config.ts';
import { goals } from '#lib/server/goals.ts';
import { readJson } from '#lib/server/http.ts';
import { PreferencesInput } from '#lib/shared/preferences.ts';
import type { RequestHandler } from './$types';

/** PATCH any of the settings (shared/preferences.ts): kept with the account, on every device and in the backup. */
export const PATCH: RequestHandler = async ({ request, locals }) => {
	const input = await readJson(request, PreferencesInput);
	// Only a language this server offers (a hidden one stays hidden).
	if (input.language && !config.languages.includes(input.language))
		error(400, 'Language not offered here');
	return json({ preferences: await goals.savePreferences(locals.session!.userId, input) });
};
