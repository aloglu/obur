// Creates a disposable database for the db test project, applies roles and migrations, and drops it afterwards.
import path from 'node:path';
import postgres from 'postgres';
import type { TestProject } from 'vitest/node';
import { bootstrapDatabase, passwordFromUrl } from '../../src/lib/server/db/bootstrap.ts';
import { loadMigrations, migrate } from '../../src/lib/server/db/migrator.ts';

export interface DbUrls {
	admin: string;
	migrator: string;
	app: string;
	worker: string;
	database: string;
}

declare module 'vitest' {
	export interface ProvidedContext {
		db: DbUrls;
	}
}

const withDatabase = (url: string, database: string) => {
	const u = new URL(url);
	u.pathname = `/${database}`;
	return u.toString();
};

export default async function setup(project: TestProject) {
	process.loadEnvFile(path.resolve(import.meta.dirname, '../../.env'));
	const env = process.env as Record<string, string>;
	const database = `obur_test_${process.pid}_${Date.now()}`;
	const urls: DbUrls = {
		database,
		admin: withDatabase(env.DATABASE_ADMIN_URL, database),
		migrator: withDatabase(env.DATABASE_MIGRATOR_URL, database),
		app: withDatabase(env.DATABASE_URL, database),
		worker: withDatabase(env.DATABASE_WORKER_URL, database)
	};

	const server = postgres(env.DATABASE_ADMIN_URL, { max: 1, onnotice: () => {} });
	await server.unsafe(`create database ${database}`);
	const admin = postgres(urls.admin, { max: 1, onnotice: () => {} });
	await bootstrapDatabase(admin, database, {
		migrator: passwordFromUrl(urls.migrator),
		app: passwordFromUrl(urls.app),
		worker: passwordFromUrl(urls.worker)
	});
	await admin.end();
	const migrator = postgres(urls.migrator, { max: 1, onnotice: () => {} });
	await migrate(migrator, await loadMigrations(path.resolve(import.meta.dirname, '../../drizzle')));
	await migrator.end();

	project.provide('db', urls);
	return async () => {
		await server.unsafe(`drop database if exists ${database} with (force)`);
		await server.end();
	};
}
