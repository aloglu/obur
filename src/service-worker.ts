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
const SHELL_ASSETS = new Set(
	[...immutable, ...assets].map(({ path }) => `/${path.replace(/^\//, '')}`)
);
const NETWORK_TIMEOUT_MS = 4000;
const NO_CACHE_PAGES = /^\/(login|setup|join|recover)(\/|$)/;
const CACHEABLE_API = [
	/^\/api\/v1\/foods\/[0-9a-f-]{36}$/,
	/^\/api\/v1\/diary\/recent$/,
	/^\/api\/v1\/measures$/,
	/^\/api\/v1\/diary\/\d{4}-\d{2}-\d{2}$/
];

sw.addEventListener('install', (event) => {
	event.waitUntil(
		caches
			.open(SHELL)
			.then((cache) => cache.addAll([...SHELL_ASSETS]))
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

async function networkFirst(request: Request): Promise<Response> {
	const cache = await caches.open(DATA);
	const key = cacheKey(request);
	try {
		const response = await Promise.race([
			fetch(request),
			new Promise<never>((_, reject) =>
				setTimeout(() => reject(new Error('timeout')), NETWORK_TIMEOUT_MS)
			)
		]);
		// Only successful, non-redirected responses are kept (never a sign-in redirect).
		if (response.ok && !response.redirected) await cache.put(key, response.clone());
		void announce(request, 'live');
		return response;
	} catch {
		const isPage =
			request.mode === 'navigate' || request.headers.get('accept')?.includes('text/html');
		const cached =
			(await cache.match(key)) ??
			(isPage ? await cache.match(new URL('/', location.origin).href) : undefined);
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
			caches.match(request, { ignoreVary: true }).then((hit) => hit ?? fetch(request))
		);
		return;
	}
	const page =
		request.mode === 'navigate' ||
		url.pathname.endsWith('/__data.json') ||
		request.headers.get('accept')?.includes('text/html');
	if (page && !NO_CACHE_PAGES.test(url.pathname)) {
		event.respondWith(networkFirst(request));
		return;
	}
	if (CACHEABLE_API.some((pattern) => pattern.test(url.pathname))) {
		event.respondWith(networkFirst(request));
	}
});
