// Creates the database roles and ownership described in docs/design.md ("Database isolation").
// Runs with the Postgres superuser only, never from the application. Safe to run repeatedly.
import type { Sql } from 'postgres';

export const ROLES = {
	migrator: 'obur_migrator',
	app: 'obur_app',
	worker: 'obur_worker'
} as const;

export type RolePasswords = Record<keyof typeof ROLES, string>;

/**
 * @param admin superuser connection to the target database
 * @param database name of the target database
 */
export async function bootstrapDatabase(
	admin: Sql,
	database: string,
	passwords: RolePasswords
): Promise<void> {
	for (const [key, role] of Object.entries(ROLES) as [keyof typeof ROLES, string][]) {
		const [{ exists }] = await admin`select exists(select 1 from pg_roles where rolname = ${role})`;
		if (!exists) await admin.unsafe(`create role ${role}`);
		// Explicit attributes: no superuser, no BYPASSRLS; runtime roles do not inherit privileges.
		const inherit = key === 'migrator' ? 'INHERIT' : 'NOINHERIT';
		const [{ stmt }] = await admin`select format(
			'alter role %I with login password %L nosuperuser nocreatedb nocreaterole noreplication nobypassrls ' || ${inherit},
			${role}::text, ${passwords[key]}::text) as stmt`;
		await admin.unsafe(stmt);
	}
	// Runtime roles must never be able to act as the schema owner. Revoked only where a membership exists: revoking one
	// that was never granted logs a warning on every start, which would hide real ones.
	for (const runtime of [ROLES.app, ROLES.worker]) {
		const [{ member }] = await admin`select exists(
			select 1 from pg_auth_members m
			join pg_roles r on r.oid = m.roleid join pg_roles u on u.oid = m.member
			where r.rolname = ${ROLES.migrator} and u.rolname = ${runtime}) as member`;
		if (member) await admin.unsafe(`revoke ${ROLES.migrator} from ${runtime}`);
	}

	const db = `"${database.replace(/"/g, '""')}"`;
	await admin.unsafe(`alter database ${db} owner to ${ROLES.migrator}`);
	await admin.unsafe(`revoke all on database ${db} from public`);
	await admin.unsafe(
		`grant connect on database ${db} to ${ROLES.migrator}, ${ROLES.app}, ${ROLES.worker}`
	);

	await admin.unsafe(`alter schema public owner to ${ROLES.migrator}`);
	await admin.unsafe(`revoke all on schema public from public`);
	await admin.unsafe(`grant usage on schema public to ${ROLES.app}, ${ROLES.worker}`);
}

/** Reads a role password from a connection URL such as DATABASE_URL. */
export function passwordFromUrl(url: string): string {
	const password = decodeURIComponent(new URL(url).password);
	if (!password) throw new Error('Connection URL has no password');
	return password;
}
