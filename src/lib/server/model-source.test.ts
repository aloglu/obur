import { describe, expect, it, vi } from 'vitest';
import { requestSource } from './model-source.ts';

describe('requestSource', () => {
	it('keeps a server-only request on the server, never the person’s provider', async () => {
		const normal = vi.fn(async () => 'openai' as const);
		expect(await requestSource(true, true, normal)).toBe('server');
		// The add-on was removed after the page offered the server: the request fails, nothing goes out.
		expect(await requestSource(true, false, normal)).toBe('local_missing');
		expect(normal).not.toHaveBeenCalled();
	});

	it('uses the person’s usual choice otherwise', async () => {
		expect(await requestSource(false, true, async () => 'openai')).toBe('openai');
		expect(await requestSource(false, false, async () => null)).toBeNull();
	});
});
