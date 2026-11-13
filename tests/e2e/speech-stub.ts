// A stand-in for the speech and OCR services in browser tests: answers /transcribe with whatever the test set through
// /next and /ocr with what it set through /next-ocr, and remembers what the app sent (/last, /last-ocr) so tests can
// check the prompt and that the audio or photo arrived. It also plays OpenAI (/openai/…) and OpenRouter
// (/openrouter/…) for people's own keys: a key starting "sk-good" is accepted, any other refused; each key's next
// answer is set through /next-provider and what the app sent is at /last-provider?key=…. Test-only; the app talks
// to it through the ordinary SPEECH_URL, LABELS_URL and AI_PROVIDER_TEST_URL settings.
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

// Per key: the next answer from a provider, and the last request (path, model, prompt, privacy routing).
const nextProvider = new Map<string, { status: number; body: unknown }>();
const lastProvider = new Map<string, Record<string, unknown>>();

let nextTags: { status: number; body: unknown } = { status: 200, body: [] };
let tagRequests = 0;

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
	if (req.method === 'POST' && req.url === '/next-provider') {
		const { key, ...answer } = JSON.parse(await read(req));
		nextProvider.set(key, answer);
		return reply(200, { ok: true });
	}
	if (req.method === 'GET' && req.url?.startsWith('/last-provider?')) {
		const key = new URL(req.url, 'http://stub').searchParams.get('key') ?? '';
		return reply(200, lastProvider.get(key) ?? {});
	}
	// The published versions (GitHub's tag list): whatever the test set, or unreachable.
	if (req.method === 'POST' && req.url === '/next-tags') {
		nextTags = JSON.parse(await read(req));
		return reply(200, { ok: true });
	}
	if (req.method === 'GET' && req.url === '/updates/tags') {
		tagRequests += 1;
		return reply(nextTags.status, nextTags.body);
	}
	if (req.method === 'GET' && req.url === '/tag-requests')
		return reply(200, { count: tagRequests });
	const provider = /^\/(openai|openrouter)(\/.*)$/.exec(req.url ?? '');
	if (provider) {
		const [, name, path] = provider;
		const key = (req.headers.authorization ?? '').replace(/^Bearer /, '');
		const raw = await read(req);
		if (!key.startsWith('sk-good'))
			return reply(401, { error: { code: 'invalid_api_key', message: 'Incorrect API key' } });
		if (req.method === 'GET' && (path === '/models' || path === '/key'))
			return reply(200, { data: [] });
		const json = req.headers['content-type']?.startsWith('application/json');
		const body = json ? JSON.parse(raw) : {};
		const prompt = json ? null : (/name="prompt"\r\n\r\n([^\r]*)/.exec(raw)?.[1] ?? null);
		const model = json ? body.model : (/name="model"\r\n\r\n([^\r]*)/.exec(raw)?.[1] ?? null);
		lastProvider.set(key, { provider: name, path, model, prompt, routing: body.provider ?? null });
		const answer = nextProvider.get(key);
		if (answer) return reply(answer.status, answer.body);
		return reply(
			200,
			path === '/chat/completions' ? { choices: [{ message: { content: '{}' } }] } : { text: '' }
		);
	}
	reply(404, { error: 'not_found' });
}).listen(Number(process.env.SPEECH_STUB_PORT ?? 4174), '127.0.0.1');
