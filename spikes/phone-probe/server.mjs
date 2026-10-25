// Phase 0 phone probe. Throwaway: not obur application code, never imported by src/.
// Configuration comes from the environment; no hostnames are hard-coded.
//   PROBE_RP_ID, PROBE_ORIGIN, PROBE_PORT, PROBE_SETUP_CODE, PROBE_DATA_DIR, PROBE_TRANSCRIBE_URL
import { randomBytes, randomUUID } from 'node:crypto';
import { readFile, writeFile, appendFile, mkdir } from 'node:fs/promises';
import { createServer } from 'node:http';
import { dirname, join, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
	generateAuthenticationOptions,
	generateRegistrationOptions,
	verifyAuthenticationResponse,
	verifyRegistrationResponse
} from '@simplewebauthn/server';

const here = dirname(fileURLToPath(import.meta.url));
const env = (name) => {
	const value = process.env[name];
	if (!value) throw new Error(`Missing ${name}`);
	return value;
};
const RP_ID = env('PROBE_RP_ID');
const ORIGIN = env('PROBE_ORIGIN');
const PORT = Number(process.env.PROBE_PORT ?? 8040);
const SETUP_CODE = env('PROBE_SETUP_CODE');
const DATA_DIR = env('PROBE_DATA_DIR');
const TRANSCRIBE_URL = process.env.PROBE_TRANSCRIBE_URL ?? 'http://127.0.0.1:8041/transcribe';
const LIMITS = { json: 64 * 1024, photo: 15 * 1024 * 1024, audio: 4 * 1024 * 1024 };
const SESSION_MAX_AGE_S = 12 * 60 * 60;

await mkdir(DATA_DIR, { recursive: true });
const credsFile = join(DATA_DIR, 'credentials.json');
const resultsFile = join(DATA_DIR, 'results.jsonl');
/** @type {{id: string, publicKey: string, counter: number, transports?: string[], created: string, label: string}[]} */
let credentials = JSON.parse(await readFile(credsFile, 'utf8').catch(() => '[]'));
const saveCreds = () => writeFile(credsFile, JSON.stringify(credentials, null, 2));
const sessions = new Map(); // token -> { created, credentialId }
const challenges = new Map(); // challenge id -> { challenge, expires }
const operations = new Map(); // operation id -> { fingerprint, result }
const userId = new TextEncoder().encode('obur-probe-user');

const record = (kind, data) =>
	appendFile(resultsFile, JSON.stringify({ at: new Date().toISOString(), kind, ...data }) + '\n');

function cookie(req, name) {
	const match = (req.headers.cookie ?? '').split(/;\s*/).find((c) => c.startsWith(name + '='));
	return match?.slice(name.length + 1);
}

function sessionOf(req) {
	const s = sessions.get(cookie(req, 'probe_session') ?? '');
	if (!s || Date.now() - s.created > SESSION_MAX_AGE_S * 1000) return undefined;
	return s;
}

function send(res, status, body, headers = {}) {
	const json = typeof body === 'string' ? body : JSON.stringify(body);
	res.writeHead(status, {
		'content-type': typeof body === 'string' ? 'text/plain; charset=utf-8' : 'application/json',
		'cache-control': 'no-store',
		...headers
	});
	res.end(json);
}

async function readBody(req, limit) {
	const chunks = [];
	let size = 0;
	for await (const chunk of req) {
		size += chunk.length;
		if (size > limit) throw Object.assign(new Error('Body too large'), { status: 413 });
		chunks.push(chunk);
	}
	return Buffer.concat(chunks);
}

const json = async (req) => JSON.parse((await readBody(req, LIMITS.json)).toString('utf8') || '{}');

function newChallenge(challenge) {
	const id = randomUUID();
	challenges.set(id, { challenge, expires: Date.now() + 5 * 60 * 1000 });
	return id;
}

function takeChallenge(id) {
	const c = challenges.get(id);
	challenges.delete(id);
	if (!c || c.expires < Date.now()) throw Object.assign(new Error('Challenge expired'), { status: 400 });
	return c.challenge;
}

function startSession(credentialId) {
	const token = randomBytes(32).toString('base64url');
	sessions.set(token, { created: Date.now(), credentialId });
	return `probe_session=${token}; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=${SESSION_MAX_AGE_S}`;
}

/** JPEG/PNG/HEIC dimensions without decoding or storing the image. */
function imageInfo(buf) {
	if (buf[0] === 0xff && buf[1] === 0xd8) {
		for (let i = 2; i < buf.length - 9; ) {
			if (buf[i] !== 0xff) break;
			const marker = buf[i + 1];
			const len = buf.readUInt16BE(i + 2);
			if (marker >= 0xc0 && marker <= 0xc3) return { type: 'jpeg', height: buf.readUInt16BE(i + 5), width: buf.readUInt16BE(i + 7) };
			i += 2 + len;
		}
		return { type: 'jpeg' };
	}
	if (buf.subarray(1, 4).toString() === 'PNG') return { type: 'png', width: buf.readUInt32BE(16), height: buf.readUInt32BE(20) };
	if (buf.subarray(4, 12).toString().includes('ftyp')) return { type: `isobmff:${buf.subarray(8, 12).toString()}` };
	return { type: 'unknown' };
}

const routes = {
	'GET /api/status': async (req) => {
		const s = sessionOf(req);
		return { signedIn: Boolean(s), credentialCount: credentials.length, credentialId: s?.credentialId ?? null,
			credentials: credentials.map((c) => ({ id: c.id.slice(0, 10), label: c.label, created: c.created })) };
	},

	'POST /api/register/options': async (req) => {
		const body = await json(req);
		// The first passkey needs the setup code; later ones need a signed-in session (adding a backup credential).
		if (!sessionOf(req) && body.setupCode !== SETUP_CODE) throw Object.assign(new Error('Setup code required'), { status: 403 });
		const options = await generateRegistrationOptions({
			rpName: 'obur probe', rpID: RP_ID, userID: userId, userName: 'probe', userDisplayName: 'obur probe',
			attestationType: 'none',
			excludeCredentials: credentials.map((c) => ({ id: c.id, transports: c.transports })),
			authenticatorSelection: { residentKey: 'required', userVerification: 'required' }
		});
		return { options, challengeId: newChallenge(options.challenge) };
	},

	'POST /api/register/verify': async (req) => {
		const body = await json(req);
		const expectedChallenge = takeChallenge(body.challengeId);
		const v = await verifyRegistrationResponse({ response: body.response, expectedChallenge, expectedOrigin: ORIGIN,
			expectedRPID: RP_ID, requireUserVerification: true });
		if (!v.verified) throw Object.assign(new Error('Not verified'), { status: 400 });
		const { credential, credentialDeviceType, credentialBackedUp } = v.registrationInfo;
		credentials.push({ id: credential.id, publicKey: Buffer.from(credential.publicKey).toString('base64url'),
			counter: credential.counter, transports: credential.transports, created: new Date().toISOString(),
			label: String(body.label ?? 'passkey').slice(0, 40) });
		await saveCreds();
		await record('register', { deviceType: credentialDeviceType, backedUp: credentialBackedUp,
			transports: credential.transports, ua: req.headers['user-agent'], standalone: body.standalone });
		return [{ ok: true, deviceType: credentialDeviceType, backedUp: credentialBackedUp }, { 'set-cookie': startSession(credential.id) }];
	},

	'POST /api/login/options': async () => {
		const options = await generateAuthenticationOptions({ rpID: RP_ID, userVerification: 'required' });
		return { options, challengeId: newChallenge(options.challenge) };
	},

	'POST /api/login/verify': async (req) => {
		const body = await json(req);
		const expectedChallenge = takeChallenge(body.challengeId);
		const cred = credentials.find((c) => c.id === body.response?.id);
		if (!cred) throw Object.assign(new Error('Unknown or removed credential'), { status: 400 });
		const v = await verifyAuthenticationResponse({ response: body.response, expectedChallenge, expectedOrigin: ORIGIN,
			expectedRPID: RP_ID, requireUserVerification: true,
			credential: { id: cred.id, publicKey: Buffer.from(cred.publicKey, 'base64url'), counter: cred.counter, transports: cred.transports } });
		if (!v.verified) throw Object.assign(new Error('Not verified'), { status: 400 });
		cred.counter = v.authenticationInfo.newCounter;
		await saveCreds();
		await record('login', { label: cred.label, ua: req.headers['user-agent'], standalone: body.standalone });
		return [{ ok: true, label: cred.label }, { 'set-cookie': startSession(cred.id) }];
	},

	'POST /api/logout': async (req) => {
		sessions.delete(cookie(req, 'probe_session') ?? '');
		return [{ ok: true }, { 'set-cookie': 'probe_session=; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=0' }];
	},

	'POST /api/credentials/remove': async (req, s) => {
		const body = await json(req);
		const before = credentials.length;
		credentials = credentials.filter((c) => !c.id.startsWith(String(body.idPrefix ?? '~')));
		await saveCreds();
		for (const [token, sess] of sessions) if (!credentials.some((c) => c.id === sess.credentialId)) sessions.delete(token);
		await record('remove-credential', { removed: before - credentials.length });
		return { ok: true, removed: before - credentials.length, signedOut: !credentials.some((c) => c.id === s.credentialId) };
	},

	'POST /api/photo': async (req) => {
		const started = Date.now();
		const buf = await readBody(req, LIMITS.photo);
		const info = { bytes: buf.length, ...imageInfo(buf), receiveMs: Date.now() - started,
			clientMs: Number(req.headers['x-client-ms'] ?? 0), source: String(req.headers['x-source'] ?? '') };
		await record('photo', { ...info, ua: req.headers['user-agent'] });
		return info; // The image itself is never written anywhere.
	},

	'POST /api/audio': async (req) => {
		const t0 = Date.now();
		const buf = await readBody(req, LIMITS.audio);
		const t1 = Date.now();
		const mime = String(req.headers['content-type'] ?? '');
		const model = String(req.headers['x-model'] ?? 'large-v3-turbo');
		const r = await fetch(TRANSCRIBE_URL, { method: 'POST', body: buf, headers: { 'content-type': mime, 'x-model': model } });
		const t = await r.json();
		const info = { bytes: buf.length, mime, model, receiveMs: t1 - t0, transcribeMs: Date.now() - t1, ...t };
		await record('audio', { ...info, ua: req.headers['user-agent'], standalone: req.headers['x-standalone'] === '1' });
		return info; // Audio stays in memory only; the speech service discards it after transcription.
	},

	'POST /api/entries': async (req) => {
		const body = await json(req);
		const fingerprint = JSON.stringify(body.payload ?? null);
		const prior = operations.get(body.operationId);
		if (prior && prior.fingerprint !== fingerprint) throw Object.assign(new Error('Operation ID reused with different content'), { status: 409 });
		if (prior) return { ...prior.result, replayed: true };
		const result = { id: body.recordId, accepted: new Date().toISOString(), createdOffline: Boolean(body.createdOffline),
			queuedFor: body.queuedAt ? Date.now() - Date.parse(body.queuedAt) : 0 };
		operations.set(body.operationId, { fingerprint, result });
		await record('entry', { ...result, attempts: body.attempts });
		return { ...result, replayed: false };
	},

	'GET /api/entries': async () => ({ entries: [...operations.values()].map((o) => o.result) })
};

const PUBLIC = join(here, 'public');
const STATIC = { '/vendor/simplewebauthn.js': join(here, 'node_modules/@simplewebauthn/browser/dist/bundle/index.umd.min.js') };
const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.webmanifest': 'application/manifest+json',
	'.png': 'image/png', '.svg': 'image/svg+xml' };
const OPEN_ROUTES = new Set(['GET /api/status', 'POST /api/register/options', 'POST /api/register/verify',
	'POST /api/login/options', 'POST /api/login/verify', 'POST /api/logout']);
const SECURITY_HEADERS = {
	'content-security-policy': "default-src 'self'; img-src 'self' blob: data:; media-src 'self' blob:; style-src 'self' 'unsafe-inline'; base-uri 'none'; frame-ancestors 'none'",
	'referrer-policy': 'no-referrer', 'x-content-type-options': 'nosniff'
};

createServer(async (req, res) => {
	const url = new URL(req.url ?? '/', ORIGIN);
	const key = `${req.method} ${url.pathname}`;
	try {
		if (routes[key]) {
			// A custom header forces a CORS preflight, so other sites cannot post to the probe.
			if (req.method === 'POST' && req.headers['x-probe'] !== '1') return send(res, 400, { error: 'Missing header' });
			const s = sessionOf(req);
			if (!OPEN_ROUTES.has(key) && !s) return send(res, 401, { error: 'Sign in first' });
			const out = await routes[key](req, s);
			const [body, headers] = Array.isArray(out) ? out : [out, {}];
			return send(res, 200, body, { ...SECURITY_HEADERS, ...headers });
		}
		if (req.method !== 'GET') return send(res, 405, 'Method not allowed');
		const file = STATIC[url.pathname] ?? join(PUBLIC, normalize(url.pathname === '/' ? '/index.html' : url.pathname));
		if (!STATIC[url.pathname] && !file.startsWith(PUBLIC)) return send(res, 404, 'Not found');
		const data = await readFile(file).catch(() => null);
		if (!data) return send(res, 404, 'Not found');
		const ext = file.slice(file.lastIndexOf('.'));
		res.writeHead(200, { 'content-type': TYPES[ext] ?? 'application/octet-stream', 'cache-control': 'no-cache', ...SECURITY_HEADERS });
		res.end(data);
	} catch (err) {
		console.error(key, err.message);
		send(res, err.status ?? 500, { error: err.status ? err.message : 'Server error' });
	}
}).listen(PORT, () => console.log(`probe listening on ${PORT} for ${ORIGIN} (RP ID ${RP_ID})`));
