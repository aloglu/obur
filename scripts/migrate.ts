// Applies pending migrations from ./drizzle as the schema owner (DATABASE_MIGRATOR_URL).
import postgres from 'postgres';
import { loadMigrations, migrate } from '../src/lib/server/db/migrator.ts';

const url = process.env.DATABASE_MIGRATOR_URL;
if (!url) throw new Error('DATABASE_MIGRATOR_URL is not set');

const sql = postgres(url, { max: 1, onnotice: () => {} });
try {
	const applied = await migrate(
		sql,
		await loadMigrations(new URL('../drizzle', import.meta.url).pathname)
	);
	console.log(applied.length ? `Applied: ${applied.join(', ')}` : 'Database is up to date.');
} finally {
	await sql.end();
}
