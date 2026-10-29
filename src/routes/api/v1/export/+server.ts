import { auth } from '#lib/server/auth.ts';
import { portability, respondPortability } from '#lib/server/portability.ts';
import type { RequestHandler } from './$types';

// POST (not GET) so the same-origin check applies; needs a recent passkey check.
export const POST: RequestHandler = ({ locals }) =>
	respondPortability(async () => {
		const session = locals.session!;
		auth.requireRecent(session);
		const now = new Date();
		const bytes = await portability.exportArchive(session.userId, now);
		return new Response(bytes as BodyInit, {
			headers: {
				'content-type': 'application/zip',
				'content-disposition': `attachment; filename="obur-export-${now.toISOString().slice(0, 10)}.zip"`,
				'cache-control': 'no-store'
			}
		});
	});
