// Creates or upgrades the background-job schema and schedules, as the schema owner (DATABASE_MIGRATOR_URL).
import postgres from 'postgres';
import { setupJobs } from '../src/lib/server/jobs/setup.ts';

const url = process.env.DATABASE_MIGRATOR_URL;
if (!url) throw new Error('DATABASE_MIGRATOR_URL is not set');
const zone = process.env.TZ || 'UTC';
const sql = postgres(url, { max: 1, onnotice: () => {} });
try {
	await setupJobs(url, sql, zone);
	console.log(`Background jobs ready (schedules in ${zone}).`);
} finally {
	await sql.end();
}
