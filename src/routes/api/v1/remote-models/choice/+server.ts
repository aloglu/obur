import { error, json } from '@sveltejs/kit';
import * as v from 'valibot';
import { auth } from '#lib/server/auth.ts';
import { readJson, respond } from '#lib/server/http.ts';
import { ModelChoiceError } from '#lib/server/modules/remote-models/index.ts';
import { remoteModels } from '#lib/server/remote-models.ts';
import { FEATURES, PROVIDERS } from '#lib/shared/remote-models.ts';
import type { RequestHandler } from './$types';

/**
 * PUT /api/v1/remote-models/choice {feature, source, allowed}: what reads Speak or Scan. A provider needs `allowed:
 * true`, sent only by the confirmation that names the company and what it receives.
 */
export const PUT: RequestHandler = ({ request, locals }) =>
	respond(async () => {
		const body = await readJson(
			request,
			v.object({
				feature: v.picklist(FEATURES),
				source: v.picklist(['server', ...PROVIDERS]),
				allowed: v.optional(v.boolean(), false)
			})
		);
		// Sending to a company needs a passkey check moments old; going back to the server never does (G18).
		if (body.source !== 'server') auth.requireRecent(locals.session!);
		try {
			return json({
				choices: await remoteModels.choose(
					locals.session!.userId,
					body.feature,
					body.source,
					body.allowed
				)
			});
		} catch (e) {
			if (e instanceof ModelChoiceError) error(409, e.message);
			throw e;
		}
	});
