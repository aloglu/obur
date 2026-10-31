// Label scanning: a photo through the OCR service (ocr/service.py), then the pure label parser. The photo is held in
// memory for the one request and never stored or logged (docs/design.md, "OCR and barcode capture").
import { RateLimiter } from '#lib/server/modules/auth/index.ts';
import {
	parseLabel,
	type LabelProposal,
	type OcrLine
} from '#lib/server/modules/label-parser/index.ts';
import { config } from './config.ts';

export const MAX_IMAGE_BYTES = 4 * 1024 * 1024;
const TIMEOUT_MS = 30_000;
/** Scans per person per 10 minutes: plenty for a shopping bag, a bound on a stuck client. */
const perPerson = new RateLimiter(30, 10 * 60_000);

export type ScanError = 'off' | 'limited' | 'too_large' | 'decode_failed' | 'busy' | 'unavailable';

export class ScanFailure extends Error {
	readonly code: ScanError;
	constructor(code: ScanError) {
		super(code);
		this.code = code;
	}
}

export async function scanLabel(
	userId: string,
	image: Uint8Array
): Promise<{ proposal: LabelProposal; ocrMs: number; queueMs: number }> {
	if (!config.ocrUrl) throw new ScanFailure('off');
	if (image.length === 0) throw new ScanFailure('decode_failed');
	if (image.length > MAX_IMAGE_BYTES) throw new ScanFailure('too_large');
	if (!perPerson.attempt(userId)) throw new ScanFailure('limited');
	let response: Response;
	try {
		response = await fetch(`${config.ocrUrl}/ocr`, {
			method: 'POST',
			headers: { 'content-type': 'application/json' },
			body: JSON.stringify({ image: Buffer.from(image).toString('base64') }),
			signal: AbortSignal.timeout(TIMEOUT_MS)
		});
	} catch {
		throw new ScanFailure('unavailable');
	}
	const body = (await response.json().catch(() => ({}))) as {
		lines?: OcrLine[];
		error?: string;
		ocrMs?: number;
		queueMs?: number;
	};
	if (!response.ok) {
		const known = ['too_large', 'decode_failed', 'busy'] as const;
		throw new ScanFailure(known.find((k) => k === body.error) ?? 'unavailable');
	}
	return {
		proposal: parseLabel(Array.isArray(body.lines) ? body.lines : []),
		ocrMs: body.ocrMs ?? 0,
		queueMs: body.queueMs ?? 0
	};
}
