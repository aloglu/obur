// Helpers for thin JSON routes: bounded, validated bodies and consistent error responses.
import { error, json, type Cookies } from '@sveltejs/kit';
import * as v from 'valibot';
import { AUTH_POLICY, AuthError, type AuthErrorCode } from '#lib/server/modules/auth/index.ts';
import { SESSION_COOKIE } from './auth.ts';
import { config } from './config.ts';

const MAX_JSON_BYTES = 64 * 1024;

/**
 * A request's body, or null as soon as it passes `max` bytes. Read as it arrives: a body sent in chunks has no
 * declared length, and reading it whole first let anyone, signed in or not, make the server hold up to the server's
 * own 21 MB limit for each request (2026-11-22 Gemini audit, G08).
 */
export async function readBody(request: Request, max: number): Promise<Uint8Array | null> {
	if (Number(request.headers.get('content-length') ?? 0) > max) return null;
	if (!request.body) return new Uint8Array();
	const reader = request.body.getReader();
	const chunks: Uint8Array[] = [];
	let size = 0;
	for (;;) {
		const { done, value } = await reader.read();
		if (done) break;
		size += value.byteLength;
		if (size > max) {
			await reader.cancel().catch(() => {});
			return null;
		}
		chunks.push(value);
	}
	const out = new Uint8Array(size);
	let at = 0;
	for (const c of chunks) {
		out.set(c, at);
		at += c.byteLength;
	}
	return out;
}

export async function readJson<S extends v.GenericSchema>(
	request: Request,
	schema: S
): Promise<v.InferOutput<S>> {
	const bytes = await readBody(request, MAX_JSON_BYTES);
	if (!bytes) error(413, 'Request too large');
	const text = new TextDecoder().decode(bytes);
	let data: unknown;
	try {
		data = text ? JSON.parse(text) : {};
	} catch {
		error(400, 'Invalid JSON');
	}
	const result = v.safeParse(schema, data);
	if (!result.success) error(400, 'Invalid request');
	return result.output;
}

const STATUS: Record<AuthErrorCode, number> = {
	setup_unavailable: 410,
	invite_unavailable: 410,
	recovery_unavailable: 400,
	not_verified: 400,
	challenge_expired: 400,
	unknown_credential: 400,
	recent_auth_required: 403,
	forbidden: 403,
	rate_limited: 429,
	last_credential: 409,
	not_found: 404
};

/** Runs a handler and turns AuthError into `{ error: code }` with a fitting status. */
export async function respond(run: () => Promise<Response>): Promise<Response> {
	try {
		return await run();
	} catch (e) {
		if (e instanceof AuthError) return json({ error: e.code }, { status: STATUS[e.code] });
		throw e;
	}
}

export function setSessionCookie(cookies: Cookies, token: string, recovery = false): void {
	cookies.set(SESSION_COOKIE, token, {
		path: '/',
		httpOnly: true,
		secure: config.secureCookies,
		sameSite: 'lax',
		maxAge: Math.floor(
			(recovery ? AUTH_POLICY.recoverySessionMs : AUTH_POLICY.sessionAbsoluteMs) / 1000
		)
	});
}

export function clearSessionCookie(cookies: Cookies): void {
	cookies.delete(SESSION_COOKIE, { path: '/', secure: config.secureCookies });
}
