// Phase 0 probe service worker: caches the app shell so the installed app opens offline. API calls are never cached.
const CACHE = 'obur-probe-v1';
const SHELL = ['/', '/app.js', '/vendor/simplewebauthn.js', '/manifest.webmanifest', '/icon-180.png'];
self.addEventListener('install', (e) => e.waitUntil(caches.open(CACHE).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting())));
self.addEventListener('activate', (e) => e.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim())));
self.addEventListener('fetch', (e) => {
	const url = new URL(e.request.url);
	if (e.request.method !== 'GET' || url.pathname.startsWith('/api/')) return;
	// Network first so fixes reach the phone, cache when offline.
	e.respondWith(fetch(e.request).then((res) => {
		const copy = res.clone();
		caches.open(CACHE).then((c) => c.put(e.request, copy));
		return res;
	}).catch(() => caches.match(e.request, { ignoreSearch: true }).then((r) => r ?? caches.match('/'))));
});
