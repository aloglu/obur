import { json } from '@sveltejs/kit';
import * as v from 'valibot';
import { auth } from '#lib/server/auth.ts';
import { clearSessionCookie, readJson } from '#lib/server/http.ts';
import { portability, respondPortability } from '#lib/server/portability.ts';
import type { RequestHandler } from './$types';

// What deleting the account needs to ask: how many foods the person has shared.
export const GET: RequestHandler = async ({ locals }) =>
	json({ sharedFoods: await portability.sharedFoodCount(locals.session!.userId) });

// Deletes the signed-in person's account (after a recent passkey check) and ends this session.
export const DELETE: RequestHandler = ({ request, locals, cookies }) =>
	respondPortability(async () => {
		const session = locals.session!;
		auth.requireRecent(session);
		const { removeSharedFoods } = await readJson(
			request,
			v.object({ removeSharedFoods: v.boolean() })
		);
		await portability.deleteAccount(session.userId, session.userId, removeSharedFoods);
		clearSessionCookie(cookies);
		return json({ deleted: true });
	});
