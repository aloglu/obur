import { json, redirect } from '@sveltejs/kit';
import { sequence, type Handle } from '@sveltejs/kit/hooks';
import { defineCustomServerStrategy, getTextDirection } from '#lib/paraglide/runtime.js';
import { paraglideMiddleware } from '#lib/paraglide/server.js';
import { auth, SESSION_COOKIE } from '#lib/server/auth.ts';
import { config } from '#lib/server/config.ts';
import { clearSessionCookie } from '#lib/server/http.ts';
import { restorePending } from '#lib/server/restore-guard.ts';
import { m } from '#lib/paraglide/messages.js';
import { isValidZone } from '#lib/shared/diary-rules.ts';
import { DEFAULT_PALETTE, isPalette, paletteOf } from '#lib/shared/themes.ts';
import { DEFAULT_APP_ICON, isAppIcon } from '#lib/shared/app-icons.ts';
import { LANGUAGE_COOKIE, pickLanguage } from '#lib/shared/languages.ts';

const cookieOf = (header: string | null, name: string) =>
	header
		?.split(';')
		.map((c) => c.trim())
		.find((c) => c.startsWith(`${name}=`))
		?.slice(name.length + 1);

// The account's or this device's last language (cookie), else the phone's (shared/languages.ts).
defineCustomServerStrategy('custom-obur', {
	getLocale: (request) =>
		pickLanguage(
			cookieOf(request?.headers.get('cookie') ?? null, LANGUAGE_COOKIE),
			request?.headers.get('accept-language')
		)
});

const handleParaglide: Handle = ({ event, resolve }) =>
	paraglideMiddleware(event.request, ({ request, locale }) => {
		// The browser reads the same cookie, so the page and its scripts agree, and the device remembers the
		// language for the sign-in pages.
		if (event.cookies.get(LANGUAGE_COOKIE) !== locale)
			event.cookies.set(LANGUAGE_COOKIE, locale, {
				path: '/',
				maxAge: 60 * 60 * 24 * 365,
				sameSite: 'lax',
				httpOnly: false,
				secure: config.secureCookies
			});
		return resolve(
			{ ...event, request },
			{
				transformPageChunk: ({ html }) =>
					html
						.replace('%paraglide.lang%', locale)
						.replace('%paraglide.dir%', getTextDirection(locale))
						.replace(
							'%obur.theme%',
							[
								event.locals.theme && `data-theme="${event.locals.theme}"`,
								event.locals.palette !== DEFAULT_PALETTE && `data-palette="${event.locals.palette}"`
							]
								.filter(Boolean)
								.join(' ')
						)
						.replace('%obur.bg.light%', paletteOf(event.locals.palette).bg[0])
						.replace('%obur.bg.dark%', paletteOf(event.locals.palette).bg[1])
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
	'/api/v1/auth/recovery/begin',
	'/manifest.webmanifest'
];
const RECOVERY_PATHS = ['/recover', '/api/v1/auth/recovery', '/api/v1/auth/logout'];
const matches = (path: string, prefixes: string[]) =>
	prefixes.some((p) => path === p || path.startsWith(`${p}/`));

const handleSession: Handle = async ({ event, resolve }) => {
	const theme = event.cookies.get('obur_theme');
	event.locals.theme = theme === 'light' || theme === 'dark' ? theme : undefined;
	const palette = event.cookies.get('obur_palette');
	event.locals.palette = isPalette(palette) ? palette : DEFAULT_PALETTE;
	const appIcon = event.cookies.get('obur_icon');
	event.locals.appIcon = isAppIcon(appIcon) ? appIcon : DEFAULT_APP_ICON;
	const time = event.cookies.get('obur_time');
	event.locals.timeFormat = time === '12' || time === '24' ? time : 'device';
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

/** Requests whose work is slow by nature (reading a recording or a photo, building or reading an archive). */
const SLOW_BY_NATURE = /^\/api\/v1\/(speak|scan|import|export|entry\/parse)/;
/** Pages and lists that take longer than this on the server are logged, so a slow one can be found and fixed. */
const SLOW_MS = 300;

/**
 * How long the server took, sent with every answer (Server-Timing, visible in the browser's developer tools), and
 * a log line for any slow one: the method, the path (never the query, which can hold searches) and the time.
 */
const handleTiming: Handle = async ({ event, resolve }) => {
	const started = performance.now();
	const response = await resolve(event);
	const ms = performance.now() - started;
	try {
		response.headers.set('server-timing', `app;dur=${ms.toFixed(1)}`);
	} catch {
		// Some responses (a redirect from fetch) have fixed headers; the time is then only logged.
	}
	const path = event.url.pathname;
	if (ms > SLOW_MS && !SLOW_BY_NATURE.test(path))
		console.log(`obur: slow: ${event.request.method} ${path} ${Math.round(ms)} ms`);
	return response;
};

export const handle: Handle = sequence(
	handleTiming,
	handleRestore,
	handleSecurity,
	handleSession,
	handleParaglide
);
