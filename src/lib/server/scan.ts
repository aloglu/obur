// Label scanning: a photo through the label-reading add-on (labels/service.py), or the person's own key with a vision
// model that copies the table (providers.ts), then the pure label parser. The photo is held in
// memory for the one request and never stored or logged (docs/design.md, "OCR and barcode capture").
import { RateLimiter } from '#lib/server/modules/auth/index.ts';
import {
	parseLabel,
	parseLabelTable,
	type LabelProposal,
	type OcrLine
} from '#lib/server/modules/label-parser/index.ts';
import type { RemoteError, Source } from '#lib/shared/remote-models.ts';
import { config } from './config.ts';
import { effectiveSource, hasLocal } from './model-source.ts';
import { RemoteFailure, readLabel } from './providers.ts';
import { remoteModels } from './remote-models.ts';

export const MAX_IMAGE_BYTES = 4 * 1024 * 1024;
/**
 * Below this the photo is called blurry (the OCR service's edge sharpness). On the owner's 22 labels, real photos
 * measured 0.26 and up; copies blurred until reading failed, 0.14 and below; reading was often still right between.
 * Provisional: measured on artificially blurred copies (docs/feasibility.md).
 */
export const BLURRY_BELOW = 0.16;
const TIMEOUT_MS = 30_000;
/** Scans per person per 10 minutes: plenty for a shopping bag, a bound on a stuck client. */
const perPerson = new RateLimiter(30, 10 * 60_000);

export type ScanError =
	'off' | 'limited' | 'too_large' | 'decode_failed' | 'busy' | 'unavailable' | RemoteError;

export class ScanFailure extends Error {
	readonly code: ScanError;
	/** When busy: how many photos the service is reading or holding. */
	readonly ahead: number | undefined;
	constructor(code: ScanError, ahead?: number) {
		super(code);
		this.code = code;
		this.ahead = ahead;
	}
}

/** `viaServer`: this one photo goes to the server's add-on even when the person chose their key. */
export async function scanLabel(
	userId: string,
	image: Uint8Array,
	viaServer = false
): Promise<{
	proposal: LabelProposal;
	source: Source;
	blurry: boolean;
	ocrMs: number;
	queueMs: number;
}> {
	const source = viaServer && hasLocal('scan') ? 'server' : await effectiveSource(userId, 'scan');
	if (!source) throw new ScanFailure('off');
	if (image.length === 0) throw new ScanFailure('decode_failed');
	if (image.length > MAX_IMAGE_BYTES) throw new ScanFailure('too_large');
	if (!perPerson.attempt(userId)) throw new ScanFailure('limited');
	if (source !== 'server') {
		const key = await remoteModels.keyFor(userId, source);
		if (!key) throw new ScanFailure('key_missing');
		const started = performance.now();
		let table;
		try {
			table = await readLabel(source, key, image);
		} catch (e) {
			if (e instanceof RemoteFailure) {
				if (e.code === 'provider_busy') perPerson.refund(userId);
				throw new ScanFailure(e.code);
			}
			throw e;
		}
		await remoteModels.countUse(userId, source, 'scan');
		const proposal = parseLabelTable(table);
		// Read by a company's model: always checked against the photo (the blurry check is the add-on's own).
		proposal.notes.unshift({ kind: 'read_by', provider: source });
		return {
			proposal,
			source,
			blurry: false,
			ocrMs: Math.round(performance.now() - started),
			queueMs: 0
		};
	}
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
		ahead?: number;
		sharpness?: number | null;
		ocrMs?: number;
		queueMs?: number;
	};
	if (!response.ok) {
		if (body.error === 'busy') {
			// The phone waits in line and asks again; asking again is not another scan.
			perPerson.refund(userId);
			const ahead = Number.isInteger(body.ahead) && body.ahead! > 0 ? body.ahead : 1;
			throw new ScanFailure('busy', Math.min(ahead!, 20));
		}
		const known = ['too_large', 'decode_failed'] as const;
		throw new ScanFailure(known.find((k) => k === body.error) ?? 'unavailable');
	}
	return {
		proposal: parseLabel(Array.isArray(body.lines) ? body.lines : []),
		source,
		blurry: typeof body.sharpness === 'number' && body.sharpness < BLURRY_BELOW,
		ocrMs: body.ocrMs ?? 0,
		queueMs: body.queueMs ?? 0
	};
}
