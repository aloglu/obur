// A stand-in for the speech and OCR services in browser tests: answers /transcribe with whatever the test set through
// /next and /ocr with what it set through /next-ocr, and remembers what the app sent (/last, /last-ocr) so tests can
// check the prompt and that the audio or photo arrived. Test-only; the app talks to it through the ordinary
// SPEECH_URL and LABELS_URL settings.
import { createServer, type IncomingMessage } from 'node:http';

let next: { status: number; body: unknown } = {
	status: 200,
	body: { text: '', language: 'tr', audioS: 1, queueMs: 0, asrMs: 1 }
};
let last: { prompt: string | null; audioBytes: number } | null = null;
// OCR answers are keyed by the photo's width, so tests running at the same time (one per browser) each get theirs.
type OcrAnswer = { status: number; body: unknown; then?: OcrAnswer };
const nextOcr = new Map<number, OcrAnswer>();
let lastOcr: { imageBytes: number; jpeg: boolean; width: number } | null = null;

/** A JPEG's width from its start-of-frame marker; 0 when not found. */
function jpegWidth(b: Buffer): number {
	for (let i = 2; i + 8 < b.length;) {
		if (b[i] !== 0xff) return 0;
		const marker = b[i + 1];
		if (marker >= 0xc0 && marker <= 0xc3) return b.readUInt16BE(i + 7);
		i += 2 + b.readUInt16BE(i + 2);
	}
	return 0;
}

const read = (req: IncomingMessage) =>
	new Promise<string>((resolve) => {
		const parts: Buffer[] = [];
		req.on('data', (c) => parts.push(c));
		req.on('end', () => resolve(Buffer.concat(parts).toString()));
	});

createServer(async (req, res) => {
	const reply = (status: number, body: unknown) => {
		res.writeHead(status, { 'content-type': 'application/json' });
		res.end(JSON.stringify(body));
	};
	if (req.method === 'GET' && req.url === '/health') return reply(200, { ok: true });
	if (req.method === 'GET' && req.url === '/last') return reply(200, last ?? {});
	if (req.method === 'POST' && req.url === '/next') {
		next = JSON.parse(await read(req));
		return reply(200, { ok: true });
	}
	if (req.method === 'GET' && req.url === '/last-ocr') return reply(200, lastOcr ?? {});
	if (req.method === 'POST' && req.url === '/next-ocr') {
		const { width, ...answer } = JSON.parse(await read(req));
		nextOcr.set(width, answer);
		return reply(200, { ok: true });
	}
	if (req.method === 'POST' && req.url === '/ocr') {
		const image = Buffer.from(JSON.parse(await read(req)).image, 'base64');
		const jpeg = image[0] === 0xff && image[1] === 0xd8;
		lastOcr = { imageBytes: image.length, jpeg, width: jpeg ? jpegWidth(image) : 0 };
		const answer = nextOcr.get(lastOcr.width) ?? { status: 200, body: { lines: [] } };
		// `then`: the answer after this one (busy, then read).
		if (answer.then) nextOcr.set(lastOcr.width, answer.then);
		return reply(answer.status, answer.body);
	}
	if (req.method === 'POST' && req.url === '/transcribe') {
		const body = JSON.parse(await read(req));
		last = { prompt: body.prompt, audioBytes: Buffer.from(body.audio, 'base64').length };
		return reply(next.status, next.body);
	}
	reply(404, { error: 'not_found' });
}).listen(Number(process.env.SPEECH_STUB_PORT ?? 4174), '127.0.0.1');
