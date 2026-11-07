// Voice entries: a short clip to text through the speech add-on (speech/service.py) or the person's own key with
// OpenAI or OpenRouter (providers.ts), then the same understanding as typed text. The audio is held in memory for the one request and never stored or logged. The prompt lists the
// person's recent foods and brands, which helps the recogniser with names (docs/feasibility.md, Speech).
import { RateLimiter } from '#lib/server/modules/auth/index.ts';
import { SPEECH_VOCABULARY } from '#lib/server/modules/nl-parser/index.ts';
import type { ParsedEntry } from '#lib/shared/entry-types.ts';
import { catalog } from './catalog.ts';
import { config } from './config.ts';
import { diary } from './diary.ts';
import { understandEntry } from './typed-entry.ts';
import { effectiveSource, hasLocal } from './model-source.ts';
import { RemoteFailure, transcribe } from './providers.ts';
import { remoteModels } from './remote-models.ts';
import type { RemoteError, Source } from '#lib/shared/remote-models.ts';

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
	| 'nothing_heard'
	| RemoteError;

export class SpeechFailure extends Error {
	readonly code: SpeechError;
	constructor(code: SpeechError) {
		super(code);
		this.code = code;
	}
}

/** The meal and unit words, then up to about 30 names, most recent first: brands and foods the person logs. */
async function promptFor(userId: string): Promise<string> {
	const ids = await diary.recentFoodIds(userId, 30);
	const foods = await catalog.foodsById(userId, ids);
	const words = new Set<string>();
	for (const f of foods) {
		if (f.brand) words.add(f.brand);
		words.add(f.name);
	}
	return `${SPEECH_VOCABULARY} ${[...words].join(', ')}`.slice(0, 600);
}

/**
 * `viaServer`: this one recording goes to the server's add-on even when the person chose their key (the link after a
 * provider's refusal). Never the other way round: nothing goes to a provider unless the person chose it.
 */
export async function understandSpeech(
	userId: string,
	audio: Uint8Array,
	viewed: string,
	zone: string,
	mime = 'audio/mp4',
	viaServer = false
): Promise<{ entry: ParsedEntry; source: Source; audioS: number; asrMs: number; queueMs: number }> {
	const source = viaServer && hasLocal('speak') ? 'server' : await effectiveSource(userId, 'speak');
	if (!source) throw new SpeechFailure('off');
	// An empty clip (Done tapped at once) is nothing heard, not an error.
	if (audio.length === 0) throw new SpeechFailure('nothing_heard');
	if (audio.length > MAX_AUDIO_BYTES) throw new SpeechFailure('too_large');
	if (!perPerson.attempt(userId)) throw new SpeechFailure('limited');
	const prompt = await promptFor(userId);
	let heard: { text: string; audioS: number; asrMs: number; queueMs: number };
	if (source === 'server') heard = await onServer(audio, prompt);
	else {
		const key = await remoteModels.keyFor(userId, source);
		if (!key) throw new SpeechFailure('key_missing');
		const started = performance.now();
		try {
			heard = {
				text: await transcribe(source, key, audio, mime, prompt),
				audioS: 0,
				asrMs: Math.round(performance.now() - started),
				queueMs: 0
			};
		} catch (e) {
			if (e instanceof RemoteFailure) {
				// A busy provider is not another recording.
				if (e.code === 'provider_busy') perPerson.refund(userId);
				throw new SpeechFailure(e.code);
			}
			throw e;
		}
		await remoteModels.countUse(userId, source, 'speak');
	}
	const text = heard.text.trim();
	if (!text) throw new SpeechFailure('nothing_heard');
	return {
		entry: await understandEntry(userId, text, viewed, zone),
		source,
		audioS: heard.audioS,
		asrMs: heard.asrMs,
		queueMs: heard.queueMs
	};
}

async function onServer(audio: Uint8Array, prompt: string) {
	let response: Response;
	try {
		response = await fetch(`${config.speechUrl}/transcribe`, {
			method: 'POST',
			headers: { 'content-type': 'application/json' },
			body: JSON.stringify({ audio: Buffer.from(audio).toString('base64'), prompt }),
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
	return {
		text: body.text ?? '',
		audioS: body.audioS ?? 0,
		asrMs: body.asrMs ?? 0,
		queueMs: body.queueMs ?? 0
	};
}
