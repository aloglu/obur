import { error, json } from '@sveltejs/kit';
import * as v from 'valibot';
import { readJson } from '#lib/server/http.ts';
import { ModelChoiceError } from '#lib/server/modules/remote-models/index.ts';
import { remoteModels } from '#lib/server/remote-models.ts';
import { FEATURES, PROVIDERS } from '#lib/shared/remote-models.ts';
import type { RequestHandler } from './$types';

/**
 * PUT /api/v1/remote-models/choice {feature, source, allowed}: what reads Speak or Scan. A provider needs `allowed:
 * true`, sent only by the confirmation that names the company and what it receives.
 */
export const PUT: RequestHandler = async ({ request, locals }) => {
	const body = await readJson(
		request,
		v.object({
			feature: v.picklist(FEATURES),
			source: v.picklist(['server', ...PROVIDERS]),
			allowed: v.optional(v.boolean(), false)
		})
	);
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
};
