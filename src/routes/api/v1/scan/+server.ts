import { json } from '@sveltejs/kit';
import { MAX_IMAGE_BYTES, ScanFailure, scanLabel } from '#lib/server/scan.ts';
import type { RequestHandler } from './$types';

const STATUS = {
	off: 404,
	limited: 429,
	too_large: 413,
	decode_failed: 422,
	busy: 503,
	unavailable: 503
} as const;

/**
 * POST /api/v1/scan with a label photo as the body (image/jpeg, image/png or image/webp). Returns the label's values
 * as a proposal to check and save; writes nothing. The photo is not kept.
 */
export const POST: RequestHandler = async ({ request, locals }) => {
	const declared = Number(request.headers.get('content-length') ?? '0');
	if (declared > MAX_IMAGE_BYTES) return json({ error: 'too_large' }, { status: 413 });
	const image = new Uint8Array(await request.arrayBuffer());
	try {
		const started = performance.now();
		const result = await scanLabel(locals.session!.userId, image);
		return json({ ...result, totalMs: Math.round(performance.now() - started) });
	} catch (e) {
		if (e instanceof ScanFailure) return json({ error: e.code }, { status: STATUS[e.code] });
		throw e;
	}
};
