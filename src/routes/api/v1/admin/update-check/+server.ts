import { error, json } from '@sveltejs/kit';
import * as v from 'valibot';
import { auth } from '#lib/server/auth.ts';
import { readJson, respond } from '#lib/server/http.ts';
import { updates } from '#lib/server/updates.ts';
import type { RequestHandler } from './$types';

/**
 * GET /api/v1/admin/update-check: what an admin sees, asking GitHub first when the stored answer is over a day
 * old and the check is on. More calls it after opening, so the page itself never waits for GitHub.
 */
export const GET: RequestHandler = ({ locals }) =>
	respond(async () => {
		const session = locals.session!;
		auth.requireAdmin(session);
		return json({ updates: await updates.status(session.userId, true) });
	});

/**
 * PUT /api/v1/admin/update-check {on}: whether obur asks GitHub for newer versions (admins). Turning it on asks
 * at once and answers with what was found.
 */
export const PUT: RequestHandler = ({ request, locals }) =>
	respond(async () => {
		const session = locals.session!;
		auth.requireAdmin(session);
		const body = await readJson(request, v.object({ on: v.boolean() }));
		const status = await updates.setCheck(session.userId, body.on);
		if (!status) error(403, 'Admins only');
		return json({ updates: status });
	});
