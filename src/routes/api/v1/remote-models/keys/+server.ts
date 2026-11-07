import { error, json } from '@sveltejs/kit';
import * as v from 'valibot';
import { readJson } from '#lib/server/http.ts';
import { checkKey } from '#lib/server/providers.ts';
import { remoteModels } from '#lib/server/remote-models.ts';
import { PROVIDERS } from '#lib/shared/remote-models.ts';
import type { RequestHandler } from './$types';

const Key = v.object({
	provider: v.picklist(PROVIDERS),
	// API keys are printable ASCII without spaces; the length bounds a pasted paragraph.
	key: v.pipe(
		v.string(),
		v.trim(),
		v.regex(/^[\x21-\x7e]{20,300}$/, 'That doesn’t look like an API key')
	)
});

/**
 * POST /api/v1/remote-models/keys {provider, key}: asks the provider once whether the key works; saves it only if it
 * does. Nothing else changes: Speak and Scan keep what they used until the person chooses the key for them.
 */
export const POST: RequestHandler = async ({ request, locals }) => {
	const userId = locals.session!.userId;
	if (!(await remoteModels.allowed(userId))) error(403, 'Personal keys are off on this server');
	const body = await readJson(request, Key);
	const result = await checkKey(body.provider, body.key);
	if (result !== 'ok')
		return json({ error: result }, { status: result === 'key_refused' ? 422 : 503 });
	await remoteModels.saveKey(userId, body.provider, body.key);
	return json({ keys: await remoteModels.keys(userId) });
};

/** DELETE /api/v1/remote-models/keys {provider}: removes the key; whatever used it goes back to the server. */
export const DELETE: RequestHandler = async ({ request, locals }) => {
	const userId = locals.session!.userId;
	const body = await readJson(request, v.object({ provider: v.picklist(PROVIDERS) }));
	await remoteModels.removeKey(userId, body.provider);
	return json({
		keys: await remoteModels.keys(userId),
		choices: await remoteModels.choices(userId)
	});
};
