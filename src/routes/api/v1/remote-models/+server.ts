import { json } from '@sveltejs/kit';
import { remoteSettings } from '#lib/server/remote-settings.ts';
import type { RequestHandler } from './$types';

/** GET /api/v1/remote-models: the person's own choices, keys (last four characters only) and this month's counts. */
export const GET: RequestHandler = async ({ locals }) =>
	json(await remoteSettings(locals.session!.userId));
