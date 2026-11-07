// Calls to OpenAI and OpenRouter with a person's own key (docs/design.md, "Remote models for Speak and Scan"). Only
// these two fixed hosts; nothing a person enters changes where the server calls. Keys and content are never logged.
// The request builders and the error mapping are pure, for tests; `AI_PROVIDER_TEST_URL` points both providers at the
// browser tests' stand-in.
import { AI_PROVIDER_TEST_URL } from '$app/env/private';
import * as v from 'valibot';
import {
	LABEL_TABLE_SCHEMA,
	LabelTable,
	type LabelTable as Table
} from '#lib/server/modules/label-parser/index.ts';
import type { Provider, RemoteError } from '#lib/shared/remote-models.ts';

/** 1.0.0's models (design: changed only in a release). */
export const MODELS = {
	openai: { speak: 'gpt-transcribe', scan: 'gpt-5-mini' },
	openrouter: { speak: 'openai/whisper-large-v3', scan: 'openai/gpt-5-mini' }
} as const;

const HOSTS: Record<Provider, string> = {
	openai: 'https://api.openai.com/v1',
	openrouter: 'https://openrouter.ai/api/v1'
};
/** OpenRouter: only endpoints that keep nothing and don't train on what they receive. */
const OPENROUTER_PRIVACY = { zdr: true, data_collection: 'deny' } as const;
const SPEAK_TIMEOUT_MS = 30_000;
const SCAN_TIMEOUT_MS = 60_000;
const CHECK_TIMEOUT_MS = 15_000;

export class RemoteFailure extends Error {
	readonly code: RemoteError;
	constructor(code: RemoteError) {
		super(code);
		this.code = code;
	}
}

function base(provider: Provider): string {
	return AI_PROVIDER_TEST_URL ? `${AI_PROVIDER_TEST_URL}/${provider}` : HOSTS[provider];
}

/** What a provider's refusal means for the person. */
export function errorFor(provider: Provider, status: number, body: unknown): RemoteError {
	const code = JSON.stringify(body ?? '').toLowerCase();
	if (status === 401 || status === 403) return 'key_refused';
	if (status === 402 || code.includes('insufficient_quota') || code.includes('credit'))
		return 'no_credit';
	if (status === 429) return 'provider_busy';
	return 'provider_unavailable';
}

/** The file name and format a provider expects for the recording's type. */
export function audioFormat(mime: string): { file: string; format: string } {
	const type = mime.split(';')[0].trim().toLowerCase();
	if (type === 'audio/mp4' || type === 'audio/x-m4a' || type === 'audio/aac')
		return { file: 'speech.m4a', format: 'm4a' };
	if (type === 'audio/ogg') return { file: 'speech.ogg', format: 'ogg' };
	if (type === 'audio/mpeg') return { file: 'speech.mp3', format: 'mp3' };
	if (type === 'audio/wav' || type === 'audio/x-wav') return { file: 'speech.wav', format: 'wav' };
	return { file: 'speech.webm', format: 'webm' };
}

const LABEL_INSTRUCTION = [
	'You copy the nutrition table from a photo of a food label. Copy, never interpret.',
	'Give each value column’s header as printed, left to right, and each row’s name as printed.',
	'Give every value exactly as printed, with its unit and any "<", keeping the decimal comma or point as printed.',
	'Use null for a value you cannot read clearly or that is empty. Never estimate, convert, total or complete a value.',
	'If there is no nutrition table, return empty columns and rows.'
].join(' ');

/** The body of a label request: the same chat request for both providers. */
export function labelRequest(provider: Provider, jpeg: Uint8Array): Record<string, unknown> {
	return {
		model: MODELS[provider].scan,
		messages: [
			{ role: 'system', content: LABEL_INSTRUCTION },
			{
				role: 'user',
				content: [
					{ type: 'text', text: 'Copy the nutrition table in this photo.' },
					{
						type: 'image_url',
						image_url: { url: `data:image/jpeg;base64,${Buffer.from(jpeg).toString('base64')}` }
					}
				]
			}
		],
		response_format: {
			type: 'json_schema',
			json_schema: { name: 'nutrition_table', strict: true, schema: LABEL_TABLE_SCHEMA }
		},
		...(provider === 'openrouter'
			? { provider: { ...OPENROUTER_PRIVACY, require_parameters: true } }
			: {})
	};
}

/** The copied table from a chat answer; an empty table when the answer can't be read. */
export function tableFrom(answer: unknown): Table {
	const empty: Table = { title: null, columns: [], rows: [] };
	const content = (answer as { choices?: { message?: { content?: unknown } }[] })?.choices?.[0]
		?.message?.content;
	if (typeof content !== 'string') return empty;
	try {
		const parsed = v.safeParse(LabelTable, JSON.parse(content));
		return parsed.success ? parsed.output : empty;
	} catch {
		return empty;
	}
}

async function call(
	provider: Provider,
	path: string,
	key: string,
	init: RequestInit,
	timeoutMs: number
) {
	let response: Response;
	try {
		response = await fetch(`${base(provider)}${path}`, {
			...init,
			headers: { ...init.headers, authorization: `Bearer ${key}` },
			signal: AbortSignal.timeout(timeoutMs)
		});
	} catch {
		throw new RemoteFailure('provider_unavailable');
	}
	const body = await response.json().catch(() => null);
	if (!response.ok) throw new RemoteFailure(errorFor(provider, response.status, body));
	return body;
}

/** Whether a key works, asked once before it is saved. */
export async function checkKey(provider: Provider, key: string): Promise<'ok' | RemoteError> {
	try {
		await call(
			provider,
			provider === 'openai' ? '/models' : '/key',
			key,
			{ method: 'GET' },
			CHECK_TIMEOUT_MS
		);
		return 'ok';
	} catch (e) {
		if (e instanceof RemoteFailure) return e.code;
		throw e;
	}
}

/** A recording to text. The prompt carries the meal and unit words and the person's recent foods (OpenAI only). */
export async function transcribe(
	provider: Provider,
	key: string,
	audio: Uint8Array,
	mime: string,
	prompt: string
): Promise<string> {
	const { file, format } = audioFormat(mime);
	let body: unknown;
	if (provider === 'openai') {
		const form = new FormData();
		form.set('model', MODELS.openai.speak);
		form.set('file', new Blob([new Uint8Array(audio)], { type: mime || 'audio/webm' }), file);
		form.set('prompt', prompt);
		body = await call(
			provider,
			'/audio/transcriptions',
			key,
			{ method: 'POST', body: form },
			SPEAK_TIMEOUT_MS
		);
	} else {
		// OpenRouter takes no prompt for transcription.
		body = await call(
			provider,
			'/audio/transcriptions',
			key,
			{
				method: 'POST',
				headers: { 'content-type': 'application/json' },
				body: JSON.stringify({
					model: MODELS.openrouter.speak,
					input_audio: { data: Buffer.from(audio).toString('base64'), format },
					provider: OPENROUTER_PRIVACY
				})
			},
			SPEAK_TIMEOUT_MS
		);
	}
	const text = (body as { text?: unknown })?.text;
	return typeof text === 'string' ? text : '';
}

/** A label photo to its table, copied as printed. */
export async function readLabel(provider: Provider, key: string, jpeg: Uint8Array): Promise<Table> {
	const answer = await call(
		provider,
		'/chat/completions',
		key,
		{
			method: 'POST',
			headers: { 'content-type': 'application/json' },
			body: JSON.stringify(labelRequest(provider, jpeg))
		},
		SCAN_TIMEOUT_MS
	);
	return tableFrom(answer);
}
