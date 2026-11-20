/// <reference types="@sveltejs/kit" />
/// <reference no-default-lib="true"/>
/// <reference lib="esnext" />
/// <reference lib="webworker" />
// obur needs a connection (docs/design.md, "Connection required"). The service worker keeps the app's code files,
// cache-first, so the app opens at once; prepares the pages likely to be opened next, in memory only, so a tap shows
// them at once; shows "obur needs a connection" when a page can't be loaded; and shows reminders. It keeps no copy
// of anyone's data on the device.
import { version } from '$app/env';
import { assets, immutable } from '$app/manifest';
import { m } from './lib/paraglide/messages.js';
import { DEFAULT_LANGUAGE, LANGUAGES } from './lib/shared/languages.ts';
import { noConnectionPage } from './lib/shared/no-connection-page.ts';
import { nothingNew } from './lib/shared/page-data.ts';
import { PREPARED_AGAIN_MS, askedLayers, mayAnswer, preparedKey } from './lib/shared/prepare.ts';

const sw = self as unknown as ServiceWorkerGlobalScope;
const SHELL = `obur-shell-${version}`;
// Paths are relative to the base path; requests are compared by absolute pathname.
// The other app icons are left out: only a Home Screen asks for them, and all of them together are megabytes.
// Food and achievement icons (about 390 files) are kept when first shown instead of all at install (2026-11-19
// audit): a page shows only a few.
const ON_FIRST_USE = /^\/icons\/(food|achievements)\//;
const SHELL_ASSETS = new Set(
	[...immutable, ...assets]
		.map(({ path }) => `/${path.replace(/^\//, '')}`)
		.filter((path) => !path.startsWith('/app-icons/') && !ON_FIRST_USE.test(path))
);
/** A page or its data that takes longer counts as no connection (iOS can leave a request hanging). */
const NETWORK_TIMEOUT_MS = 10_000;
/** Preparing ahead gives up sooner: nothing waits for it. */
const PREPARE_TIMEOUT_MS = 3000;
/**
 * For this long after a failed request, a page waits only this much for the server: a hanging connection costs a
 * moment per tap, not 10 seconds, and a connection that came back works at once.
 */
const UNREACHABLE_HOLD_MS = 60_000;
const HELD_TIMEOUT_MS = 3000;
/** Sent by a page (or the connection page) that has just reached the server: the hold ends. */
const REACHABLE = 'obur:reachable';

sw.addEventListener('install', (event) => {
	// File by file rather than addAll: one missing or failing file must not stop the whole install. Missing files
	// are fetched when first needed.
	event.waitUntil(
		caches
			.open(SHELL)
			.then((cache) => Promise.allSettled([...SHELL_ASSETS].map((path) => cache.add(path))))
			.then(() => sw.skipWaiting())
	);
});

// Keeps the previous version's code too: a page opened before an update still runs the old code and must find its
// files (seen on the owner's iPhone after a deploy). Older versions are removed, and so is everything the offline
// support of earlier versions kept (saved pages, the account marker, the food copy; removed 2026-11-20).
const KEEP_SHELLS = 2;

sw.addEventListener('activate', (event) => {
	event.waitUntil(
		caches
			.keys()
			.then((keys) => {
				// Versions are build times, so the newest sort last.
				const shells = keys.filter((k) => k.startsWith('obur-shell-')).sort();
				const keep = new Set([...shells.slice(-KEEP_SHELLS), SHELL]);
				return Promise.all(keys.filter((k) => !keep.has(k)).map((k) => caches.delete(k)));
			})
			.then(() => sw.clients.claim())
	);
});

let unreachableUntil = 0;
const unreachable = () => Date.now() < unreachableUntil;
const failed = () => (unreachableUntil = Date.now() + UNREACHABLE_HOLD_MS);

sw.addEventListener('message', (event) => {
	const type = event.data?.type;
	if (type === REACHABLE) {
		unreachableUntil = 0;
		event.ports[0]?.postMessage('ok');
	} else if (type === 'obur:prepare' && Array.isArray(event.data.urls)) {
		event.waitUntil(prepareAll(event.data.urls as string[]));
	} else if (type === 'obur:forget' || type === 'obur:signed-out') {
		// The time zone changed, or the page signed out: nothing prepared stays.
		forgetPrepared();
	}
});

// Pages prepared ahead (shared/prepare.ts): the open page names the pages likely to be opened next, and their data
// is fetched now, so a tap shows the page at once. Kept in memory only, for a minute; any write (signing in and out
// included) drops them all, and nothing fetched while a write was under way is kept, so a prepared page never
// predates a change made here or belongs to someone who signed out.
interface Prepared {
	body: ArrayBuffer;
	status: number;
	headers: [string, string][];
	at: number;
	layers: string | null;
}
const prepared = new Map<string, Prepared>();
/** Preparations under way: a request for one waits for it rather than asking the server a second time. */
const preparing = new Map<string, Promise<void>>();
/** Writes under way, and a count that changes with each one, so a fetch can tell whether one happened meanwhile. */
let writes = 0;
let generation = 0;

function forgetPrepared() {
	generation++;
	prepared.clear();
}

async function prepareOne(url: string) {
	const key = preparedKey(url);
	const known = prepared.get(key);
	if (preparing.has(key) || (known && Date.now() - known.at < PREPARED_AGAIN_MS)) return;
	let done = () => {};
	preparing.set(key, new Promise<void>((resolve) => (done = resolve)));
	const startedAt = generation;
	try {
		const response = await fetch(url, {
			credentials: 'same-origin',
			signal: AbortSignal.timeout(PREPARE_TIMEOUT_MS)
		}).catch((e: unknown) => {
			// Hanging or failing like any other request: pages show the connection page at once for a while.
			failed();
			throw e;
		});
		unreachableUntil = 0;
		if (!response.ok || response.redirected || response.type !== 'basic') return;
		const body = await response.arrayBuffer();
		if (generation !== startedAt || writes > 0) return;
		prepared.set(key, {
			body,
			status: response.status,
			headers: [...response.headers],
			at: Date.now(),
			layers: askedLayers(url)
		});
	} catch {
		// Not reachable: the page is asked for again when it is opened.
	} finally {
		preparing.delete(key);
		done();
	}
}

/** A few at a time, so a page change never waits behind a queue of preparations. */
async function prepareAll(urls: string[]) {
	const queue = urls.filter((u) => {
		try {
			return new URL(u).origin === location.origin;
		} catch {
			return false;
		}
	});
	const worker = async () => {
		for (let url = queue.shift(); url !== undefined; url = queue.shift()) await prepareOne(url);
	};
	await Promise.all([worker(), worker(), worker()]);
}

/** A prepared answer for this request, if one may answer it. */
function preparedAnswer(request: Request): Response | undefined {
	if (writes > 0) return undefined;
	const entry = prepared.get(preparedKey(request.url));
	if (!entry || !mayAnswer(entry, request.url, Date.now())) return undefined;
	return new Response(entry.body.slice(0), { status: entry.status, headers: entry.headers });
}

/** A change sent to the server: prepared pages may now be out of date, before and after it lands. */
async function write(request: Request): Promise<Response> {
	writes++;
	forgetPrepared();
	try {
		const response = await fetch(request).catch((e: unknown) => {
			failed();
			throw e;
		});
		unreachableUntil = 0;
		return response;
	} finally {
		writes--;
		forgetPrepared();
		// Open pages prepare again (client/prepare.ts).
		for (const client of await sw.clients.matchAll({ type: 'window' }))
			client.postMessage({ type: 'obur:written' });
	}
}

/** The network's answer, or a rejection after the time limit (which also starts the hold). */
async function fromNetwork(request: Request): Promise<Response> {
	const limit = unreachable() ? HELD_TIMEOUT_MS : NETWORK_TIMEOUT_MS;
	try {
		const response = await Promise.race([
			fetch(request),
			new Promise<never>((_, reject) => setTimeout(() => reject(new Error('timeout')), limit))
		]);
		unreachableUntil = 0;
		return response;
	} catch (e) {
		failed();
		throw e;
	}
}

let connectionPage: string | undefined;

/** "obur needs a connection", in every language; the page picks one by the language cookie. */
function noConnection(): Response {
	connectionPage ??= noConnectionPage(
		Object.fromEntries(
			LANGUAGES.map((locale) => [
				locale,
				{
					title: m.no_connection_title({}, { locale }),
					line: m.no_connection_line({}, { locale }),
					retry: m.no_connection_retry({}, { locale }),
					still: m.no_connection_still({}, { locale })
				}
			])
		),
		DEFAULT_LANGUAGE,
		REACHABLE
	);
	return new Response(connectionPage, {
		status: 503,
		headers: { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store' }
	});
}

/** A page opened in full (the app's start, a reload, a link): the server's, or the connection page. */
async function page(request: Request): Promise<Response> {
	return fromNetwork(request).catch(noConnection);
}

const nothingChanged = (body: string) =>
	new Response(body, {
		headers: { 'content-type': 'application/json', 'cache-control': 'private, no-store' }
	});

/**
 * A page's data on a page change. When it can't be loaded, the page loads in full instead (SvelteKit does that
 * after failed data), which shows the connection page. A background refresh of what all pages share is answered
 * "nothing new" instead, so it never replaces the page being looked at.
 */
async function pageData(request: Request): Promise<Response> {
	const quiet = nothingNew(new URL(request.url).searchParams.get('x-sveltekit-invalidated'));
	// A background refresh doesn't wait on a connection that just failed.
	if (quiet && unreachable()) return nothingChanged(quiet);
	try {
		const response = await fromNetwork(request);
		return quiet && response.status >= 500 ? nothingChanged(quiet) : response;
	} catch {
		return quiet ? nothingChanged(quiet) : Response.error();
	}
}

sw.addEventListener('fetch', (event) => {
	const { request } = event;
	const url = new URL(request.url);
	if (url.origin !== location.origin) return;
	if (request.method !== 'GET') {
		event.respondWith(write(request));
		return;
	}

	// Hashed files never change, so any cached version's copy is right (including the previous version's). Icons
	// kept on first use are the exception (below).
	if (
		SHELL_ASSETS.has(url.pathname) ||
		url.pathname.startsWith('/_app/immutable/') ||
		ON_FIRST_USE.test(url.pathname)
	) {
		// ignoreVary: a module import sends headers (Origin) that the install-time copy was not fetched with.
		event.respondWith(
			(async () => {
				// This version's files first; the other versions only matter for a page still running older code.
				const shell = await caches.open(SHELL);
				const own = await shell.match(request, { ignoreVary: true });
				if (own) return own;
				// An icon isn't hashed and may have changed: the previous version's copy only without a connection.
				const older = () => caches.match(request, { ignoreVary: true });
				if (!ON_FIRST_USE.test(url.pathname)) {
					const hit = await older();
					if (hit) return hit;
				}
				const response = await fetch(request).catch(async (e: unknown) => {
					const hit = await older();
					if (hit) return hit;
					throw e;
				});
				// Fill a gap left at install time, so it is there next time.
				if (response.ok) event.waitUntil(shell.put(request, response.clone()).catch(() => {}));
				return response;
			})()
		);
		return;
	}
	// Prepared a moment ago for exactly this: answered at once.
	const ready = preparedAnswer(request);
	if (ready) {
		event.respondWith(ready);
		return;
	}
	// Being prepared right now (a finger touched it a moment ago): wait for that answer.
	const underWay = preparing.get(preparedKey(request.url));
	if (underWay) {
		event.respondWith(underWay.then(() => preparedAnswer(request) ?? answer(request)));
		return;
	}
	const handled = route(request, url);
	if (handled) event.respondWith(handled);
});

/** How a GET is answered when nothing prepared applies; undefined when it goes to the network untouched. */
function route(request: Request, url: URL): Promise<Response> | undefined {
	if (request.mode === 'navigate') return page(request);
	if (url.pathname.endsWith('/__data.json')) return pageData(request);
	return undefined;
}

const answer = (request: Request) => route(request, new URL(request.url)) ?? fetch(request);

// Reminders (docs/ui.md, "Reminders"): show what the server sent; a tap opens the app, reusing an open window.
sw.addEventListener('push', (event) => {
	let data: { title?: string; body?: string; tag?: string; url?: string } = {};
	try {
		data = event.data?.json() ?? {};
	} catch {
		// Not JSON: show the generic title only.
	}
	event.waitUntil(
		sw.registration.showNotification(data.title ?? 'obur', {
			body: data.body,
			tag: data.tag,
			icon: '/icon-192.png',
			badge: '/brand/favicon-brown.png',
			data: { url: data.url ?? '/' }
		})
	);
});

sw.addEventListener('notificationclick', (event) => {
	event.notification.close();
	const url = new URL((event.notification.data as { url?: string })?.url ?? '/', sw.location.origin)
		.href;
	event.waitUntil(
		(async () => {
			const windows = await sw.clients.matchAll({ type: 'window', includeUncontrolled: true });
			const open = windows.find((w) => new URL(w.url).origin === sw.location.origin);
			if (open) {
				await open.focus();
				await open.navigate(url).catch(() => undefined);
			} else await sw.clients.openWindow(url);
		})()
	);
});
