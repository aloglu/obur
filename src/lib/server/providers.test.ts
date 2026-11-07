// Requests to OpenAI and OpenRouter and what their refusals mean, without a real key.
import { describe, expect, it, vi } from 'vitest';

vi.mock('$app/env/private', () => ({ AI_PROVIDER_TEST_URL: null }));

interface ChatRequest {
	model: string;
	response_format: { json_schema: { strict: boolean } };
	messages: { content: { image_url?: { url: string } }[] }[];
	provider?: unknown;
}
const { audioFormat, errorFor, labelRequest, tableFrom } = await import('./providers.ts');

describe('refusals', () => {
	it.each([
		['openai', 401, { error: { code: 'invalid_api_key' } }, 'key_refused'],
		['openrouter', 403, {}, 'key_refused'],
		['openai', 429, { error: { code: 'insufficient_quota' } }, 'no_credit'],
		['openrouter', 402, { error: { message: 'Insufficient credits' } }, 'no_credit'],
		['openai', 429, { error: { code: 'rate_limit_exceeded' } }, 'provider_busy'],
		['openrouter', 502, null, 'provider_unavailable'],
		['openai', 500, null, 'provider_unavailable']
	] as const)('%s %i means %s', (provider, status, body, want) => {
		expect(errorFor(provider, status, body)).toBe(want);
	});
});

describe('recordings', () => {
	it('name their format as the providers expect', () => {
		expect(audioFormat('audio/mp4')).toEqual({ file: 'speech.m4a', format: 'm4a' });
		expect(audioFormat('audio/webm;codecs=opus')).toEqual({ file: 'speech.webm', format: 'webm' });
		expect(audioFormat('audio/ogg; codecs=opus').format).toBe('ogg');
		expect(audioFormat('').format).toBe('webm');
	});
});

describe('label requests', () => {
	it('send the photo with a strict table schema; OpenRouter only to endpoints that keep nothing', () => {
		const jpeg = new Uint8Array([0xff, 0xd8, 0xff]);
		const openai = labelRequest('openai', jpeg) as unknown as ChatRequest;
		expect(openai.model).toBe('gpt-5-mini');
		expect(openai.response_format.json_schema.strict).toBe(true);
		expect(openai.messages[1].content[1].image_url?.url).toBe('data:image/jpeg;base64,/9j/');
		expect(openai.provider).toBeUndefined();
		const openrouter = labelRequest('openrouter', jpeg) as unknown as ChatRequest;
		expect(openrouter.model).toBe('openai/gpt-5-mini');
		expect(openrouter.provider).toEqual({
			zdr: true,
			data_collection: 'deny',
			require_parameters: true
		});
	});

	it('read the copied table from the answer, and nothing from an answer that isn’t one', () => {
		const table = {
			title: null,
			columns: ['per 100 g'],
			rows: [{ name: 'Fat', values: ['1,8 g'] }]
		};
		expect(tableFrom({ choices: [{ message: { content: JSON.stringify(table) } }] })).toEqual(
			table
		);
		const empty = { title: null, columns: [], rows: [] };
		expect(tableFrom({ choices: [{ message: { content: 'Sorry, I can’t help' } }] })).toEqual(
			empty
		);
		expect(tableFrom({ choices: [{ message: { content: '{"rows": 3}' } }] })).toEqual(empty);
		expect(tableFrom(null)).toEqual(empty);
	});
});
