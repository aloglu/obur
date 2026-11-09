import { error, json } from '@sveltejs/kit';
import * as v from 'valibot';
import { auth } from '#lib/server/auth.ts';
import { readJson, respond } from '#lib/server/http.ts';
import { remoteModels } from '#lib/server/remote-models.ts';
import type { RequestHandler } from './$types';

/**
 * PUT /api/v1/household/personal-keys {allow}: whether people may use their own AI keys (admins, with a recent
 * passkey check). `respond` answers a stale check with `recent_auth_required`, so the page asks for the passkey.
 */
export const PUT: RequestHandler = ({ request, locals }) =>
	respond(async () => {
		const session = locals.session!;
		auth.requireAdmin(session);
		const body = await readJson(request, v.object({ allow: v.boolean() }));
		if (!(await remoteModels.setHouseholdAllows(session.userId, body.allow)))
			error(403, 'Admins only');
		return json({ allow: body.allow });
	});
