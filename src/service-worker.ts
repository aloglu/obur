/// <reference types="@sveltejs/kit" />
/// <reference no-default-lib="true"/>
/// <reference lib="esnext" />
/// <reference lib="webworker" />
// Offline support within the bounded scope of docs/design.md ("Offline scope and synchronization"): the app shell
// is cache-first so the installed app opens offline; signed-in pages and a few read-only API responses are
// network-first with a cached fallback, so the last-seen day and recent foods stay viewable. Sign-in flows and
// all writes always go to the network. The data cache is cleared on sign-out and when another person signs in.
import { version } from '$app/env';
import { assets, immutable } from '$app/manifest';
import { answerFromCopy, mergePageData, nothingNew } from './lib/shared/page-data-copy.ts';
import { PREPARED_AGAIN_MS, askedLayers, mayAnswer, preparedKey } from './lib/shared/prepare.ts';

const sw = self as unknown as ServiceWorkerGlobalScope;
const SHELL = `obur-shell-${version}`;
const DATA = 'obur-data-v1';
// Paths are relative to the base path; requests are compared by absolute pathname.
// The other app icons are left out: only a Home Screen asks for them, and all of them together are megabytes.
const SHELL_ASSETS = new Set(
	[...immutable, ...assets]
		.map(({ path }) => `/${path.replace(/^\//, '')}`)
		.filter((path) => !path.startsWith('/app-icons/'))
);
const NETWORK_TIMEOUT_MS = 3000;
const NO_CACHE_PAGES = /^\/(login|setup|join|recover)(\/|$)/;
const CACHEABLE_API = [
	/^\/api\/v1\/foods\/[0-9a-f-]{36}$/,
	/^\/api\/v1\/diary\/recent$/,
	/^\/api\/v1\/measures$/,
	/^\/api\/v1\/diary\/\d{4}-\d{2}-\d{2}$/
];

sw.addEventListener('install', (event) => {
	// File by file rather than addAll: one missing or failing file must not stop the whole install (with addAll it
	// does, and the app then has no offline support at all). Missing files are fetched when first needed.
	event.waitUntil(
		caches
			.open(SHELL)
			.then((cache) => Promise.allSettled([...SHELL_ASSETS].map((path) => cache.add(path))))
			.then(() => sw.skipWaiting())
	);
});

// Keeps the previous version's shell too: a page opened before an update still runs the old code, and offline it
// must still find that code's files (seen on the owner's iPhone after a deploy). Older versions are removed.
const KEEP_SHELLS = 2;

sw.addEventListener('activate', (event) => {
	event.waitUntil(
		caches
			.keys()
			.then((keys) => {
				// Versions are build times, so the newest sort last.
				const shells = keys.filter((k) => k.startsWith('obur-shell-')).sort();
				const keep = new Set([...shells.slice(-KEEP_SHELLS), SHELL]);
				return Promise.all(shells.filter((k) => !keep.has(k)).map((k) => caches.delete(k)));
			})
			.then(() => sw.clients.claim())
	);
});

/** SvelteKit varies x-sveltekit-invalidated between data requests; it does not change the data's meaning. */
function cacheKey(request: Request): string {
	const url = new URL(request.url);
	url.searchParams.delete('x-sveltekit-invalidated');
	return url.href;
}

/**
 * Tells open pages whether the page data they just received is live or this device's saved copy, so they can say
 * so and refresh again later. Only for page data, not the API responses components fetch.
 */
async function announce(request: Request, copy: 'live' | 'cached') {
	const url = new URL(request.url);
	if (request.mode !== 'navigate' && !url.pathname.endsWith('/__data.json')) return;
	for (const client of await sw.clients.matchAll({ type: 'window' }))
		client.postMessage({ type: 'obur:page-data', copy });
}

/** After a failed request, pages come from the saved copy at once for this long (iOS can hang offline requests). */
const UNREACHABLE_HOLD_MS = 60_000;
let unreachableUntil = 0;

// A page that has just reached the server (its queue sent something) ends the hold at once, so the refresh that
// follows shows live data instead of the saved copy. The reply tells the page it may refresh now.
sw.addEventListener('message', (event) => {
	const type = event.data?.type;
	if (type === 'obur:reachable') {
		unreachableUntil = 0;
		event.ports[0]?.postMessage('ok');
	} else if (type === 'obur:prepare' && Array.isArray(event.data.urls)) {
		event.waitUntil(prepareAll(event.data.urls as string[]));
	} else if (type === 'obur:forget') {
		forgetPrepared();
	}
});

// Pages prepared ahead (shared/prepare.ts): the open page names the pages likely to be opened next, and their data
// is fetched now, so a tap shows the page at once. Kept in memory only, for a minute; any write drops them all,
// and nothing fetched while a write was under way is kept, so a prepared page never predates a change made here.
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
			signal: AbortSignal.timeout(NETWORK_TIMEOUT_MS)
		}).catch((e: unknown) => {
			// Hanging or failing like any other request: pages come from the saved copy at once for a while.
			unreachableUntil = Date.now() + UNREACHABLE_HOLD_MS;
			throw e;
		});
		unreachableUntil = 0;
		if (!response.ok || response.redirected || response.type !== 'basic') return;
		const body = await response.clone().arrayBuffer();
		if (generation !== startedAt || writes > 0) return;
		prepared.set(key, {
			body,
			status: response.status,
			headers: [...response.headers],
			at: Date.now(),
			layers: askedLayers(url)
		});
		// It is fresh: the copy for use offline gets it too.
		await save(await caches.open(DATA), key, response);
	} catch {
		// Not reachable: the page is answered from the saved copy when it is opened.
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
		return await fetch(request);
	} finally {
		writes--;
		forgetPrepared();
		// Open pages prepare again (client/prepare.ts).
		for (const client of await sw.clients.matchAll({ type: 'window' }))
			client.postMessage({ type: 'obur:written' });
	}
}

const isPageData = (key: string) => new URL(key).pathname.endsWith('/__data.json');
/** Which parts of a page's data a request asked for (SvelteKit's digits); null means all of them. */
const askedParts = (request: Request) =>
	new URL(request.url).searchParams.get('x-sveltekit-invalidated');

/** A response with another body: the original's headers, without the ones that described the old body. */
function rewritten(body: string, original: Response): Response {
	const headers = new Headers(original.headers);
	headers.delete('content-length');
	headers.delete('content-encoding');
	return new Response(body, { status: original.status, headers });
}

/** Writes to the saved copies wait for each other, so two answers for one page build on one another in order. */
let saving: Promise<unknown> = Promise.resolve();

/**
 * Keeps a copy of an answer. A page change brings only part of a page's data (often just the page, not what all
 * pages share), so page data is laid over the copy already there (shared/page-data-copy.ts).
 */
function save(cache: Cache, key: string, response: Response): Promise<unknown> {
	if (!isPageData(key)) return cache.put(key, response);
	const write = async () => {
		const fresh = await response.text();
		const merged = mergePageData(await (await cache.match(key))?.text(), fresh);
		if (merged !== undefined) await cache.put(key, rewritten(merged, response));
	};
	return (saving = saving.then(write, write));
}

async function fromNetwork(
	event: FetchEvent,
	request: Request,
	cache: Cache,
	key: string,
	announceLive: boolean
) {
	let response: Response;
	try {
		response = await Promise.race([
			fetch(request),
			new Promise<never>((_, reject) =>
				setTimeout(() => reject(new Error('timeout')), NETWORK_TIMEOUT_MS)
			)
		]);
	} catch (e) {
		unreachableUntil = Date.now() + UNREACHABLE_HOLD_MS;
		throw e;
	}
	unreachableUntil = 0;
	// Only successful, non-redirected responses are kept (never a sign-in redirect). The page gets its answer at
	// once; the copy is written behind it (writing first held every page change back, most on a phone).
	if (response.ok && !response.redirected)
		event.waitUntil(save(cache, key, response.clone()).catch(() => {}));
	if (announceLive) void announce(request, 'live');
	return response;
}

/**
 * The saved copy for a request. Pages that read their query in the browser (the + buttons open /log?meal=…) are
 * served from the copy saved under the plain address; any other page never saved gets the "not available offline"
 * page, never another page in its place (a day's address must not show today).
 */
const READS_OWN_QUERY = new Set(['/log']);

async function savedCopy(request: Request, cache: Cache, key: string) {
	const exact = await cache.match(key);
	// Page data: only the parts this request asked for.
	if (exact && isPageData(key))
		return rewritten(answerFromCopy(await exact.text(), askedParts(request)), exact);
	if (exact) return exact;
	const isPage =
		request.mode === 'navigate' || request.headers.get('accept')?.includes('text/html');
	if (!isPage) return undefined;
	const plain = new URL(request.url);
	plain.search = '';
	const samePage = READS_OWN_QUERY.has(plain.pathname) ? await cache.match(plain.href) : undefined;
	return samePage ?? (await cache.match(new URL('/offline', location.origin).href));
}

const pageData = (body: string) =>
	new Response(body, {
		headers: { 'content-type': 'application/json', 'cache-control': 'private, no-store' }
	});

async function networkFirst(event: FetchEvent): Promise<Response> {
	const { request } = event;
	const cache = await caches.open(DATA);
	const key = cacheKey(request);
	// Known to be unreachable a moment ago: answer from the saved copy without waiting, and keep checking the
	// network in the background (which also refreshes the copy and ends the hold once it is back).
	if (Date.now() < unreachableUntil) {
		const cached = await savedCopy(request, cache, key);
		if (cached) {
			event.waitUntil(fromNetwork(event, request.clone(), cache, key, false).catch(() => {}));
			void announce(request, 'cached');
			return cached;
		}
	}
	try {
		const response = await fromNetwork(event, request, cache, key, true);
		// The server is there but failing, and this only refreshes what pages share: leave the page as it is
		// rather than replace it with an error.
		const quiet = response.status >= 500 && isPageData(key) && nothingNew(askedParts(request));
		return quiet ? pageData(quiet) : response;
	} catch {
		const cached = await savedCopy(request, cache, key);
		if (cached) void announce(request, 'cached');
		if (cached) return cached;
		// A refresh of what pages share, with nothing saved to answer it: nothing changed, the page stays.
		const quiet = isPageData(key) && nothingNew(askedParts(request));
		if (quiet) return pageData(quiet);
		return new Response('Offline', { status: 503, headers: { 'content-type': 'text/plain' } });
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

	// Hashed files never change, so any cached version's copy is right (including the previous version's).
	if (SHELL_ASSETS.has(url.pathname) || url.pathname.startsWith('/_app/immutable/')) {
		// ignoreVary: a module import sends headers (Origin) that the install-time copy was not fetched with.
		event.respondWith(
			(async () => {
				// This version's files first: looking through every cache means searching the saved pages too, which
				// grow with use. The other caches only matter for a page still running the previous version.
				const shell = await caches.open(SHELL);
				const hit =
					(await shell.match(request, { ignoreVary: true })) ??
					(await caches.match(request, { ignoreVary: true }));
				if (hit) return hit;
				const response = await fetch(request);
				// Fill a gap left at install time, so it is there next time the network is not.
				if (response.ok) event.waitUntil(shell.put(request, response.clone()).catch(() => {}));
				return response;
			})()
		);
		return;
	}
	// Prepared a moment ago for exactly this: answered at once.
	const ready = preparedAnswer(request);
	if (ready) {
		void announce(request, 'live');
		event.respondWith(ready);
		return;
	}
	// Being prepared right now (a finger touched it a moment ago): wait for that answer.
	const underWay = preparing.get(preparedKey(request.url));
	if (underWay) {
		event.respondWith(
			underWay.then(() => {
				const arrived = preparedAnswer(request);
				if (arrived) {
					void announce(request, 'live');
					return arrived;
				}
				return answerNormally(event);
			})
		);
		return;
	}
	const handled = route(event, url);
	if (handled) event.respondWith(handled);
});

/** How a GET is answered when nothing prepared applies; undefined when it goes to the network untouched. */
function route(event: FetchEvent, url: URL): Promise<Response> | undefined {
	const { request } = event;
	const page =
		request.mode === 'navigate' ||
		url.pathname.endsWith('/__data.json') ||
		request.headers.get('accept')?.includes('text/html');
	if (page && !NO_CACHE_PAGES.test(url.pathname)) return networkFirst(event);
	if (CACHEABLE_API.some((pattern) => pattern.test(url.pathname))) return networkFirst(event);
	return undefined;
}

const answerNormally = (event: FetchEvent) =>
	route(event, new URL(event.request.url)) ?? fetch(event.request);

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
