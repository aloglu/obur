import { redirect } from '@sveltejs/kit';
import { config } from '#lib/server/config.ts';
import { reminders } from '#lib/server/reminders.ts';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals }) => {
	if (!config.pushKey) redirect(303, '/more');
	return { settings: await reminders.settings(locals.session!.userId, locals.zone) };
};
