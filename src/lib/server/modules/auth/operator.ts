// Operator commands that run on the server as the schema owner, never through the web app
// (docs/design.md, "Passkeys and recovery"). Links carry the token in the URL fragment, which browsers never
// send to the server, so it cannot appear in access logs or referrers.
import type { Sql } from 'postgres';
import { POLICY } from './policy.ts';
import { hashToken, newToken } from './tokens.ts';

export class OperatorError extends Error {}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Creates a one-time setup link for the first admin. Refused once any account exists. */
export async function issueSetupLink(sql: Sql, origin: string, now = new Date()): Promise<string> {
	const token = newToken();
	await sql.begin(async (tx) => {
		const [{ n }] = await tx`select count(*)::int as n from users`;
		if (n > 0) throw new OperatorError('An account already exists; use invites instead.');
		// Only the newest setup link works.
		await tx`delete from bootstrap_tokens where used_at is null`;
		await tx`insert into bootstrap_tokens (token_hash, expires_at)
			values (${hashToken(token)}, ${new Date(now.getTime() + POLICY.bootstrapMs)})`;
	});
	return `${origin}/setup#${token}`;
}

/** Creates a one-hour re-enrolment link for a member identified by ID or exact display name. */
export async function issueRecoveryLink(
	sql: Sql,
	origin: string,
	who: string,
	now = new Date()
): Promise<{ link: string; displayName: string }> {
	const matches = UUID.test(who)
		? await sql`select id, display_name from users where id = ${who} and disabled_at is null`
		: await sql`select id, display_name from users where display_name = ${who} and disabled_at is null`;
	if (matches.length !== 1) {
		throw new OperatorError(
			matches.length ? 'Several people share that name; use their ID.' : 'No active person matches.'
		);
	}
	const token = newToken();
	await sql`insert into recovery_links (user_id, token_hash, expires_at)
		values (${matches[0].id}, ${hashToken(token)}, ${new Date(now.getTime() + POLICY.recoveryLinkMs)})`;
	return { link: `${origin}/recover#${token}`, displayName: matches[0].display_name };
}
