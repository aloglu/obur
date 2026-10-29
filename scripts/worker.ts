// The background worker: runs scheduled maintenance as the worker role (DATABASE_WORKER_URL). Today that is the
// nightly trash purge; jobs that concern one person will set that person's identity before touching their data.
import { PgBoss } from 'pg-boss';
import postgres from 'postgres';
import { JOB_SCHEMA, QUEUES } from '../src/lib/server/jobs/setup.ts';

const url = process.env.DATABASE_WORKER_URL;
if (!url) throw new Error('DATABASE_WORKER_URL is not set');
const concurrency = Math.max(1, Number(process.env.WORKER_CONCURRENCY ?? 1) || 1);

const sql = postgres(url, { max: concurrency, onnotice: () => {} });
const boss = new PgBoss({
	connectionString: url,
	schema: JOB_SCHEMA,
	// The schema owner creates and upgrades the job tables during migration.
	migrate: false,
	createSchema: false,
	max: concurrency + 1
});
boss.on('error', (e) => console.error('pg-boss:', e.message));
await boss.start();

await boss.work(QUEUES.purgeTrash, { localConcurrency: concurrency }, async () => {
	const rows = await sql`select kind, purged::int from app_purge_trash(now() - interval '30 days')`;
	const total = rows.reduce((n, r) => n + r.purged, 0);
	console.log(
		`purge-trash: removed ${total} expired trash rows`,
		Object.fromEntries(rows.map((r) => [r.kind, r.purged]))
	);
});
console.log(`worker: started (concurrency ${concurrency})`);

let stopping = false;
async function stop() {
	if (stopping) return;
	stopping = true;
	await boss.stop({ graceful: true, timeout: 20_000 });
	await sql.end({ timeout: 5 });
	process.exit(0);
}
process.on('SIGTERM', stop);
process.on('SIGINT', stop);
