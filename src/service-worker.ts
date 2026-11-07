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
	if (event.data?.type !== 'obur:reachable') return;
	unreachableUntil = 0;
	event.ports[0]?.postMessage('ok');
});

async function fromNetwork(request: Request, cache: Cache, key: string, announceLive: boolean) {
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
	// Only successful, non-redirected responses are kept (never a sign-in redirect).
	if (response.ok && !response.redirected) await cache.put(key, response.clone());
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
	if (exact) return exact;
	const isPage =
		request.mode === 'navigate' || request.headers.get('accept')?.includes('text/html');
	if (!isPage) return undefined;
	const plain = new URL(request.url);
	plain.search = '';
	const samePage = READS_OWN_QUERY.has(plain.pathname) ? await cache.match(plain.href) : undefined;
	return samePage ?? (await cache.match(new URL('/offline', location.origin).href));
}

async function networkFirst(event: FetchEvent): Promise<Response> {
	const { request } = event;
	const cache = await caches.open(DATA);
	const key = cacheKey(request);
	// Known to be unreachable a moment ago: answer from the saved copy without waiting, and keep checking the
	// network in the background (which also refreshes the copy and ends the hold once it is back).
	if (Date.now() < unreachableUntil) {
		const cached = await savedCopy(request, cache, key);
		if (cached) {
			event.waitUntil(fromNetwork(request.clone(), cache, key, false).catch(() => {}));
			void announce(request, 'cached');
			return cached;
		}
	}
	try {
		return await fromNetwork(request, cache, key, true);
	} catch {
		const cached = await savedCopy(request, cache, key);
		if (cached) void announce(request, 'cached');
		return (
			cached ?? new Response('Offline', { status: 503, headers: { 'content-type': 'text/plain' } })
		);
	}
}

sw.addEventListener('fetch', (event) => {
	const { request } = event;
	if (request.method !== 'GET') return;
	const url = new URL(request.url);
	if (url.origin !== location.origin) return;

	// Hashed files never change, so any cached version's copy is right (including the previous version's).
	if (SHELL_ASSETS.has(url.pathname) || url.pathname.startsWith('/_app/immutable/')) {
		// ignoreVary: a module import sends headers (Origin) that the install-time copy was not fetched with.
		event.respondWith(
			caches.match(request, { ignoreVary: true }).then(
				(hit) =>
					hit ??
					fetch(request).then(async (response) => {
						// Fill a gap left at install time, so it is there next time the network is not.
						if (response.ok) await (await caches.open(SHELL)).put(request, response.clone());
						return response;
					})
			)
		);
		return;
	}
	const page =
		request.mode === 'navigate' ||
		url.pathname.endsWith('/__data.json') ||
		request.headers.get('accept')?.includes('text/html');
	if (page && !NO_CACHE_PAGES.test(url.pathname)) {
		event.respondWith(networkFirst(event));
		return;
	}
	if (CACHEABLE_API.some((pattern) => pattern.test(url.pathname))) {
		event.respondWith(networkFirst(event));
	}
});

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
