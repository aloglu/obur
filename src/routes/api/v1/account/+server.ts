import { json } from '@sveltejs/kit';
import * as v from 'valibot';
import { auth } from '#lib/server/auth.ts';
import { clearSessionCookie, readJson } from '#lib/server/http.ts';
import { portability, respondPortability } from '#lib/server/portability.ts';
import type { RequestHandler } from './$types';

// Deletes the signed-in person's account (after a recent passkey check) and ends this session.
export const DELETE: RequestHandler = ({ request, locals, cookies }) =>
	respondPortability(async () => {
		const session = locals.session!;
		auth.requireRecent(session);
		// A body is still sent ({}): SvelteKit refuses a bodyless DELETE behind the proxy as a cross-site form post.
		await readJson(request, v.object({}));
		await portability.deleteAccount(session.userId, session.userId);
		clearSessionCookie(cookies);
		locals.session = undefined;
		return json({ deleted: true });
	});
