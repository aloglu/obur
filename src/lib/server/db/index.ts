// Runtime connection as the non-superuser application role. User data is only queried through withUser().
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { DATABASE_URL } from '$app/env/private';

if (!DATABASE_URL) throw new Error('DATABASE_URL is not set');

export const db = drizzle(postgres(DATABASE_URL));
export { withUser, IdentityError, type Database, type Tx } from './identity.ts';
