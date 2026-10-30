// Recreates the disposable end-to-end database (obur_e2e) with roles and migrations. Used by playwright.config.ts.
import path from 'node:path';
import postgres from 'postgres';
import { bootstrapDatabase, passwordFromUrl } from '../src/lib/server/db/bootstrap.ts';
import { loadMigrations, migrate } from '../src/lib/server/db/migrator.ts';
import { loadCuratedFoods, readCuratedFile } from '../src/lib/server/modules/catalog/curated.ts';

const env = (name: string) => {
	const value = process.env[name];
	if (!value) throw new Error(`${name} is not set`);
	return value;
};
const database = env('E2E_DATABASE');
const at = (url: string) => Object.assign(new URL(url), { pathname: `/${database}` }).toString();
const quiet = { max: 1, onnotice: () => {} };

const server = postgres(env('DATABASE_ADMIN_URL'), quiet);
await server.unsafe(`drop database if exists ${database} with (force)`);
await server.unsafe(`create database ${database}`);
await server.end();

const admin = postgres(at(env('DATABASE_ADMIN_URL')), quiet);
await bootstrapDatabase(admin, database, {
	migrator: passwordFromUrl(env('DATABASE_MIGRATOR_URL')),
	app: passwordFromUrl(env('DATABASE_URL')),
	worker: passwordFromUrl(env('DATABASE_WORKER_URL'))
});
await admin.end();

const migrator = postgres(at(env('DATABASE_MIGRATOR_URL')), quiet);
await migrate(migrator, await loadMigrations(path.resolve(import.meta.dirname, '../drizzle')));
// As in production, where `obur migrate` loads them.
await loadCuratedFoods(migrator, readCuratedFile());
await migrator.end();
console.log(`Prepared ${database}`);
