import { describe, expect, it } from 'vitest';
import { readBody } from './http.ts';

/** A body sent in pieces, with no declared length, as `Transfer-Encoding: chunked` arrives. */
function chunked(pieces: number, size: number): Request {
	let sent = 0;
	const body = new ReadableStream<Uint8Array>({
		pull(controller) {
			if (sent++ === pieces) return controller.close();
			controller.enqueue(new Uint8Array(size).fill(65));
		}
	});
	return new Request('http://x/', { method: 'POST', body, duplex: 'half' } as RequestInit);
}

describe('readBody (G08)', () => {
	it('stops reading a body without a declared length once it passes the limit', async () => {
		expect(await readBody(chunked(1000, 1024), 64 * 1024)).toBeNull();
	});

	it('returns a body within the limit whole', async () => {
		const bytes = await readBody(chunked(3, 1000), 64 * 1024);
		expect(bytes?.length).toBe(3000);
		expect(bytes?.every((b) => b === 65)).toBe(true);
	});

	it('refuses a declared length over the limit without reading', async () => {
		const request = new Request('http://x/', {
			method: 'POST',
			body: 'x',
			headers: { 'content-length': String(10 ** 9) }
		});
		expect(await readBody(request, 1024)).toBeNull();
	});
});
