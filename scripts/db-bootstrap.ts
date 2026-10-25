// Creates roles and ownership for the database in DATABASE_ADMIN_URL. Run once per database, as the superuser.
import postgres from 'postgres';
import { bootstrapDatabase, passwordFromUrl } from '../src/lib/server/db/bootstrap.ts';

const env = (name: string): string => {
	const value = process.env[name];
	if (!value) throw new Error(`${name} is not set`);
	return value;
};

const adminUrl = env('DATABASE_ADMIN_URL');
const database = new URL(adminUrl).pathname.slice(1);
const admin = postgres(adminUrl, { max: 1, onnotice: () => {} });
try {
	await bootstrapDatabase(admin, database, {
		migrator: passwordFromUrl(env('DATABASE_MIGRATOR_URL')),
		app: passwordFromUrl(env('DATABASE_URL')),
		worker: passwordFromUrl(env('DATABASE_WORKER_URL'))
	});
	console.log(`Bootstrapped roles and ownership for database "${database}".`);
} finally {
	await admin.end();
}
