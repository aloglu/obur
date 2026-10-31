import { error, json } from '@sveltejs/kit';
import { config } from '#lib/server/config.ts';
import { readJson } from '#lib/server/http.ts';
import { reminders } from '#lib/server/reminders.ts';
import { ReminderSettingsInput } from '#lib/shared/reminders.ts';
import type { RequestHandler } from './$types';

const enabled = () => {
	if (!config.pushKey) error(404, 'Reminders are off on this server');
};

export const GET: RequestHandler = async ({ locals }) => {
	enabled();
	return json(await reminders.settings(locals.session!.userId, locals.zone));
};

/** PUT the whole settings: a time per reminder (null when off), quiet hours, and the device's time zone. */
export const PUT: RequestHandler = async ({ request, locals }) => {
	enabled();
	const body = await readJson(request, ReminderSettingsInput);
	await reminders.saveSettings(locals.session!.userId, body);
	return json(body);
};
