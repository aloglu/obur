// Background jobs (pg-boss, in PostgreSQL). The job tables live in their own schema, created and upgraded by the
// schema owner as part of the migration step; the worker role only reads and writes jobs. pg-boss tables hold no
// personal data: a job that ever concerns one person must carry that person's ID and run under their identity.
import { PgBoss } from 'pg-boss';
import type { Sql } from 'postgres';

export const JOB_SCHEMA = 'pgboss';
export const QUEUES = { purgeTrash: 'purge-trash', sendReminders: 'send-reminders' } as const;
/** Daily, in the server's configured zone, outside typical logging hours. */
export const PURGE_CRON = '30 3 * * *';
/** Every five minutes; each person's reminders follow their own zone (shared/reminders.ts). */
export const REMINDERS_CRON = '*/5 * * * *';

/** Creates or upgrades the job schema, the queues and their schedules, then grants the worker its access. */
export async function setupJobs(migratorUrl: string, owner: Sql, timeZone: string): Promise<void> {
	const boss = new PgBoss({
		connectionString: migratorUrl,
		schema: JOB_SCHEMA,
		supervise: false,
		schedule: false,
		max: 1
	});
	boss.on('error', (e) => console.error('pg-boss:', e.message));
	await boss.start();
	try {
		if (!(await boss.getQueue(QUEUES.purgeTrash))) {
			await boss.createQueue(QUEUES.purgeTrash, { retryLimit: 3, retryDelay: 600 });
		}
		await boss.schedule(QUEUES.purgeTrash, PURGE_CRON, null, { tz: timeZone });
		// A missed run is not retried: the next one, five minutes later, covers it (reminders have a send window).
		if (!(await boss.getQueue(QUEUES.sendReminders))) {
			await boss.createQueue(QUEUES.sendReminders, { retryLimit: 0, expireInSeconds: 240 });
		}
		await boss.schedule(QUEUES.sendReminders, REMINDERS_CRON, null, { tz: 'UTC' });
	} finally {
		await boss.stop({ graceful: true });
	}
	// The worker processes jobs; it never creates or alters job tables.
	await owner.unsafe(`
		grant usage on schema ${JOB_SCHEMA} to obur_worker;
		grant select, insert, update, delete on all tables in schema ${JOB_SCHEMA} to obur_worker;
		grant usage, select on all sequences in schema ${JOB_SCHEMA} to obur_worker;
		grant execute on all functions in schema ${JOB_SCHEMA} to obur_worker;
		alter default privileges in schema ${JOB_SCHEMA}
			grant select, insert, update, delete on tables to obur_worker;
	`);
}
