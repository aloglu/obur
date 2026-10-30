// Voice entries: a short clip to text through the speech service (speech/service.py), then the same understanding as
// typed text. The audio is held in memory for the one request and never stored or logged. The prompt lists the
// person's recent foods and brands, which helps the recogniser with names (docs/feasibility.md, Speech).
import { RateLimiter } from '#lib/server/modules/auth/index.ts';
import type { ParsedEntry } from '#lib/shared/entry-types.ts';
import { catalog } from './catalog.ts';
import { config } from './config.ts';
import { diary } from './diary.ts';
import { understandEntry } from './typed-entry.ts';

export const MAX_AUDIO_BYTES = 4 * 1024 * 1024;
const TIMEOUT_MS = 30_000;
/** Clips per person per 10 minutes: plenty for logging, a bound on a stuck client. */
const perPerson = new RateLimiter(40, 10 * 60_000);

export type SpeechError =
	| 'off'
	| 'limited'
	| 'too_large'
	| 'too_long'
	| 'decode_failed'
	| 'busy'
	| 'unavailable'
	| 'nothing_heard';

export class SpeechFailure extends Error {
	constructor(readonly code: SpeechError) {
		super(code);
	}
}

/** Up to about 30 names, most recent first: brands and food names the person actually logs. */
async function promptFor(userId: string): Promise<string> {
	const ids = await diary.recentFoodIds(userId, 30);
	const foods = await catalog.foodsById(userId, ids);
	const words = new Set<string>();
	for (const f of foods) {
		if (f.brand) words.add(f.brand);
		words.add(f.name);
	}
	return [...words].join(', ').slice(0, 500);
}

export async function understandSpeech(
	userId: string,
	audio: Uint8Array,
	viewed: string,
	zone: string
): Promise<{ entry: ParsedEntry; audioS: number; asrMs: number; queueMs: number }> {
	if (!config.speechUrl) throw new SpeechFailure('off');
	// An empty clip (Done tapped at once) is nothing heard, not an error.
	if (audio.length === 0) throw new SpeechFailure('nothing_heard');
	if (audio.length > MAX_AUDIO_BYTES) throw new SpeechFailure('too_large');
	if (!perPerson.attempt(userId)) throw new SpeechFailure('limited');
	let response: Response;
	try {
		response = await fetch(`${config.speechUrl}/transcribe`, {
			method: 'POST',
			headers: { 'content-type': 'application/json' },
			body: JSON.stringify({
				audio: Buffer.from(audio).toString('base64'),
				prompt: await promptFor(userId)
			}),
			signal: AbortSignal.timeout(TIMEOUT_MS)
		});
	} catch {
		throw new SpeechFailure('unavailable');
	}
	const body = (await response.json().catch(() => ({}))) as {
		text?: string;
		error?: string;
		audioS?: number;
		asrMs?: number;
		queueMs?: number;
	};
	if (!response.ok) {
		const known = ['too_large', 'too_long', 'decode_failed', 'busy'] as const;
		throw new SpeechFailure(known.find((k) => k === body.error) ?? 'unavailable');
	}
	const text = (body.text ?? '').trim();
	if (!text) throw new SpeechFailure('nothing_heard');
	return {
		entry: await understandEntry(userId, text, viewed, zone),
		audioS: body.audioS ?? 0,
		asrMs: body.asrMs ?? 0,
		queueMs: body.queueMs ?? 0
	};
}
