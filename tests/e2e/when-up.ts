// Waits until a URL answers at all (any HTTP status), for a second test server that must start after the first one's
// build: `node tests/e2e/when-up.ts http://127.0.0.1:4173/ && node server.js`.
const url = process.argv[2];
const until = Date.now() + 300_000;
for (;;) {
	try {
		await fetch(url, { redirect: 'manual' });
		break;
	} catch {
		if (Date.now() > until) throw new Error(`${url} did not come up`);
		await new Promise((done) => setTimeout(done, 500));
	}
}
