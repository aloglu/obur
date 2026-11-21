import { error, json } from '@sveltejs/kit';
import { isIsoDate, isValidZone } from '#lib/shared/diary-rules.ts';
import { MAX_AUDIO_BYTES, SpeechFailure, understandSpeech } from '#lib/server/speech.ts';
import type { RequestHandler } from './$types';

const STATUS = {
	off: 404,
	limited: 429,
	too_large: 413,
	too_long: 422,
	decode_failed: 422,
	busy: 503,
	unavailable: 503,
	key_missing: 409,
	key_refused: 502,
	no_credit: 502,
	provider_busy: 503,
	provider_unavailable: 503,
	nothing_heard: 422
} as const;

/**
 * POST /api/v1/speech?date=YYYY-MM-DD&zone=Area/City with the recorded clip as the body (audio/*). Returns what was
 * heard as an entry to confirm; writes nothing. The audio is not kept. `&via=server`: this recording goes to the
 * server's own add-on even when the person chose their key. `&at=<ISO time>`: when it was recorded, which relative
 * days ("yesterday") count from; a time in the future or over a day ago counts as now.
 */
const DAY_MS = 24 * 3600_000;
function recordedAt(value: string | null, now = new Date()): Date {
	const at = value ? new Date(value) : null;
	if (!at || Number.isNaN(at.getTime())) return now;
	const age = now.getTime() - at.getTime();
	return age < -60_000 || age > DAY_MS ? now : at;
}

export const POST: RequestHandler = async ({ request, url, locals }) => {
	const date = url.searchParams.get('date') ?? '';
	const zone = url.searchParams.get('zone') ?? '';
	if (!isIsoDate(date) || !isValidZone(zone)) error(400, 'Invalid date or zone');
	const declared = Number(request.headers.get('content-length') ?? '0');
	if (declared > MAX_AUDIO_BYTES) return json({ error: 'too_large' }, { status: 413 });
	const audio = new Uint8Array(await request.arrayBuffer());
	try {
		const started = performance.now();
		const result = await understandSpeech(
			locals.session!.userId,
			audio,
			date,
			zone,
			request.headers.get('content-type') ?? 'audio/mp4',
			url.searchParams.get('via') === 'server',
			recordedAt(url.searchParams.get('at'))
		);
		return json({ ...result, totalMs: Math.round(performance.now() - started) });
	} catch (e) {
		if (e instanceof SpeechFailure) return json({ error: e.code }, { status: STATUS[e.code] });
		throw e;
	}
};
