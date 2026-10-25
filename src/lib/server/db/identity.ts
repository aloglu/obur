// The trusted wrapper for user-scoped queries (docs/design.md, "Database isolation"): every user query runs in a
// transaction that sets app.user_id transaction-locally on the same connection, so pooled connections never
// carry one user's identity into another request. Missing or malformed identity fails closed.
import { sql } from 'drizzle-orm';
import type { PostgresJsDatabase } from 'drizzle-orm/postgres-js';

export type Database = PostgresJsDatabase;
export type Tx = Parameters<Parameters<Database['transaction']>[0]>[0];

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export class IdentityError extends Error {}

export async function withUser<T>(
	db: Database,
	userId: string,
	run: (tx: Tx) => Promise<T>
): Promise<T> {
	if (typeof userId !== 'string' || !UUID.test(userId)) {
		throw new IdentityError('A valid user identity is required');
	}
	return db.transaction(async (tx) => {
		await tx.execute(sql`select set_config('app.user_id', ${userId}, true)`);
		return run(tx);
	});
}
