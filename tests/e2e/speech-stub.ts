// A stand-in for the speech service in browser tests: answers /transcribe with whatever the test set through /next,
// and remembers what the app sent (/last) so tests can check the prompt and that audio arrived. Test-only; the app
// talks to it through the ordinary SPEECH_URL setting.
import { createServer, type IncomingMessage } from 'node:http';

let next: { status: number; body: unknown } = {
	status: 200,
	body: { text: '', language: 'tr', audioS: 1, queueMs: 0, asrMs: 1 }
};
let last: { prompt: string | null; audioBytes: number } | null = null;

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
	if (req.method === 'POST' && req.url === '/transcribe') {
		const body = JSON.parse(await read(req));
		last = { prompt: body.prompt, audioBytes: Buffer.from(body.audio, 'base64').length };
		return reply(next.status, next.body);
	}
	reply(404, { error: 'not_found' });
}).listen(Number(process.env.SPEECH_STUB_PORT ?? 4174), '127.0.0.1');
