import { json } from '@sveltejs/kit';
import { portability, readArchiveBody, respondPortability } from '#lib/server/portability.ts';
import type { RequestHandler } from './$types';

// The archive is the request body. ?apply=1 imports; otherwise this is the dry run.
export const POST: RequestHandler = ({ request, url, locals }) =>
	respondPortability(async () => {
		const bytes = await readArchiveBody(request);
		const userId = locals.session!.userId;
		const summary =
			url.searchParams.get('apply') === '1'
				? await portability.applyImport(userId, bytes)
				: await portability.previewImport(userId, bytes);
		return json({ summary });
	});
