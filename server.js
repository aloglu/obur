// Production web server: the adapter-node handler, plus cache headers that matter when a CDN sits in front (such as
// Cloudflare, which caches .js files by default). The service worker and the web app manifest must never be served
// from a cache: a stale service worker lists files a newer build no longer has, fails to install, and the app then
// cannot open pages offline (seen on the owner's iPhone, 2026-10-29).
import http from 'node:http';
import { handler } from './build/handler.js';

const NO_STORE = new Set(['/service-worker.js', '/manifest.webmanifest']);

const server = http.createServer((req, res) => {
	const path = (req.url ?? '/').split('?')[0];
	if (NO_STORE.has(path)) res.setHeader('cache-control', 'no-store');
	handler(req, res, () => {
		res.statusCode = 404;
		res.end('Not found');
	});
});

const port = Number(process.env.PORT ?? 3000);
server.listen(port, process.env.HOST ?? '0.0.0.0', () => console.log(`Listening on port ${port}`));

function stop() {
	server.close(() => process.exit(0));
	setTimeout(() => process.exit(0), 10_000).unref();
}
process.on('SIGTERM', stop);
process.on('SIGINT', stop);
