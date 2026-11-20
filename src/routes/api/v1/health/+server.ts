// Readiness for Docker's health check: the web app answers and the app's own database role can run a query. The
// sign-in page alone never touched the database, so obur looked healthy with a database it couldn't use (2026-11-20
// audit, R12). Reachable without a session; it says nothing but ok.
import { json, type RequestHandler } from '@sveltejs/kit';
import { sql } from 'drizzle-orm';
import { db } from '#lib/server/db/index.ts';

export const GET: RequestHandler = async () => {
	let timer: ReturnType<typeof setTimeout> | undefined;
	try {
		await Promise.race([
			db.execute(sql`select 1`),
			new Promise((_, reject) => (timer = setTimeout(() => reject(new Error('timeout')), 3000)))
		]);
		return json({ ok: true });
	} catch {
		return json({ ok: false }, { status: 503 });
	} finally {
		clearTimeout(timer);
	}
};
