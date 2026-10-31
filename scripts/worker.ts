// The background worker: runs scheduled work as the worker role (DATABASE_WORKER_URL): the nightly trash purge and,
// when Web Push keys are configured, reminders every five minutes. Jobs that concern one person set that person's
// identity before touching their data (modules/reminders).
import { drizzle } from 'drizzle-orm/postgres-js';
import { PgBoss } from 'pg-boss';
import postgres from 'postgres';
import webpush from 'web-push';
import messages from '../messages/en.json' with { type: 'json' };
import { JOB_SCHEMA, QUEUES } from '../src/lib/server/jobs/setup.ts';
import { sendDueReminders } from '../src/lib/server/modules/reminders/index.ts';

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
// Reminders: only with all three Web Push settings. The notification says what to do, never values (docs/design.md).
const vapid = {
	publicKey: process.env.VAPID_PUBLIC_KEY,
	privateKey: process.env.VAPID_PRIVATE_KEY,
	subject: process.env.VAPID_SUBJECT
};
if (vapid.publicKey && vapid.privateKey && vapid.subject) {
	webpush.setVapidDetails(vapid.subject, vapid.publicKey, vapid.privateKey);
	const db = drizzle(sql);
	await boss.work(QUEUES.sendReminders, async () => {
		const sent = await sendDueReminders(db, new Date(), async (to, kind) => {
			// The reminder is the title; iOS adds "from obur" below it itself (owner's choice, 2026-10-31).
			const payload = JSON.stringify({ title: messages[`reminder_${kind}`], url: '/', tag: kind });
			try {
				await webpush.sendNotification(
					{ endpoint: to.endpoint, keys: { p256dh: to.p256dh, auth: to.auth } },
					payload,
					{ TTL: 3600, urgency: 'normal', timeout: 10_000 }
				);
				return 'sent';
			} catch (e) {
				const status = (e as { statusCode?: number }).statusCode;
				return status === 404 || status === 410 ? 'gone' : 'failed';
			}
		});
		if (sent) console.log(`send-reminders: sent ${sent}`);
	});
} else {
	console.log(
		'worker: reminders off (VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY and VAPID_SUBJECT not all set)'
	);
}
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
