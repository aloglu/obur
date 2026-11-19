import { json } from '@sveltejs/kit';
import { version } from '$app/env';
import { catalog } from '#lib/server/catalog.ts';
import type { RequestHandler } from './$types';

/**
 * Every food the person can log, for the copy the service worker keeps for offline search (docs/design.md,
 * "Offline scope"). It asks with the copy's ETag and gets 304 while nothing changed, so a day without changes costs
 * one small query. The app version is part of the tag: an update can change the built-in foods.
 */
export const GET: RequestHandler = async ({ locals, request }) => {
	const userId = locals.session!.userId;
	const tag = `"${Buffer.from(`${version}|${userId}|${await catalog.offlineFoodsStamp(userId)}`).toString('base64url')}"`;
	const headers = { etag: tag, 'cache-control': 'private, no-cache' };
	if (request.headers.get('if-none-match') === tag)
		return new Response(null, { status: 304, headers });
	return json({ foods: await catalog.offlineFoods(userId) }, { headers });
};
