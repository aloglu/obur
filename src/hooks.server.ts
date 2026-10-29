import { json, redirect } from '@sveltejs/kit';
import { sequence, type Handle } from '@sveltejs/kit/hooks';
import { getTextDirection } from '#lib/paraglide/runtime.js';
import { paraglideMiddleware } from '#lib/paraglide/server.js';
import { auth, SESSION_COOKIE } from '#lib/server/auth.ts';
import { config } from '#lib/server/config.ts';
import { clearSessionCookie } from '#lib/server/http.ts';
import { restorePending } from '#lib/server/restore-guard.ts';
import { m } from '#lib/paraglide/messages.js';
import { isValidZone } from '#lib/shared/diary-rules.ts';

const handleParaglide: Handle = ({ event, resolve }) =>
	paraglideMiddleware(event.request, ({ request, locale }) => {
		return resolve(
			{ ...event, request },
			{
				transformPageChunk: ({ html }) =>
					html
						.replace('%paraglide.lang%', locale)
						.replace('%paraglide.dir%', getTextDirection(locale))
						.replace('%obur.theme%', event.locals.theme ? `data-theme="${event.locals.theme}"` : '')
			}
		);
	});

/** Closed while a restore is pending: nothing is read or written until it is finished. */
const handleRestore: Handle = ({ event, resolve }) => {
	if (!restorePending()) return resolve(event);
	const headers = { 'retry-after': '300', 'cache-control': 'no-store' };
	if (event.url.pathname.startsWith('/api/'))
		return json({ error: 'restoring' }, { status: 503, headers });
	const text = m.restore_in_progress();
	return new Response(
		`<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>obur</title><p style="font:17px system-ui;margin:3rem 1.5rem">${text}</p></html>`,
		{ status: 503, headers: { ...headers, 'content-type': 'text/html; charset=utf-8' } }
	);
};

const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

/** Same-origin check for every state change (CSRF), plus response hardening headers. */
const handleSecurity: Handle = async ({ event, resolve }) => {
	if (!SAFE_METHODS.has(event.request.method)) {
		if (event.request.headers.get('origin') !== config.origin) {
			return json({ error: 'forbidden' }, { status: 403 });
		}
	}
	const response = await resolve(event);
	response.headers.set('referrer-policy', 'no-referrer');
	response.headers.set('x-content-type-options', 'nosniff');
	response.headers.set('permissions-policy', 'camera=(self), microphone=(self), geolocation=()');
	if (config.secureCookies) {
		response.headers.set('strict-transport-security', 'max-age=31536000');
	}
	return response;
};

// Reachable without a session. Recovery sessions are confined to RECOVERY_PATHS.
const PUBLIC_PATHS = [
	'/login',
	'/setup',
	'/join',
	'/recover',
	'/api/v1/auth/login',
	'/api/v1/auth/setup',
	'/api/v1/auth/join',
	'/api/v1/auth/recovery/begin'
];
const RECOVERY_PATHS = ['/recover', '/api/v1/auth/recovery', '/api/v1/auth/logout'];
const matches = (path: string, prefixes: string[]) =>
	prefixes.some((p) => path === p || path.startsWith(`${p}/`));

const handleSession: Handle = async ({ event, resolve }) => {
	const theme = event.cookies.get('obur_theme');
	event.locals.theme = theme === 'light' || theme === 'dark' ? theme : undefined;
	const zone = event.cookies.get('obur_zone') ?? '';
	event.locals.zone = isValidZone(zone) ? zone : 'UTC';

	const token = event.cookies.get(SESSION_COOKIE);
	const session = await auth.resolveSession(token);
	if (token && !session) clearSessionCookie(event.cookies);
	event.locals.session = session;

	const path = event.url.pathname;
	const api = path.startsWith('/api/');
	if (session?.kind === 'recovery' && !matches(path, RECOVERY_PATHS)) {
		if (api) return json({ error: 'forbidden' }, { status: 403 });
		redirect(303, '/recover');
	}
	if (!session && !matches(path, PUBLIC_PATHS)) {
		if (api) return json({ error: 'unauthenticated' }, { status: 401 });
		redirect(303, '/login');
	}
	return resolve(event);
};

export const handle: Handle = sequence(
	handleRestore,
	handleSecurity,
	handleSession,
	handleParaglide
);
