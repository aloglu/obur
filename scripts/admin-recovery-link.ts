// Prints a one-hour re-enrolment link for someone who lost all passkeys and recovery codes.
// Usage: npm run admin:recovery-link -- "<display name or user ID>"
import postgres from 'postgres';
import { issueRecoveryLink, OperatorError } from '../src/lib/server/modules/auth/operator.ts';

const url = process.env.DATABASE_MIGRATOR_URL;
const origin = process.env.PUBLIC_ORIGIN;
const who = process.argv[2];
if (!url || !origin) throw new Error('DATABASE_MIGRATOR_URL and PUBLIC_ORIGIN must be set');
if (!who) {
	console.error('Usage: npm run admin:recovery-link -- "<display name or user ID>"');
	process.exit(1);
}

const sql = postgres(url, { max: 1, onnotice: () => {} });
try {
	const { link, displayName } = await issueRecoveryLink(sql, new URL(origin).origin, who);
	console.log(
		`Recovery link for ${displayName} (valid for 1 hour, works once). Send it privately:`
	);
	console.log(link);
	console.log('Using it removes their old passkeys, sessions and recovery codes.');
} catch (e) {
	if (e instanceof OperatorError) {
		console.error(e.message);
		process.exitCode = 1;
	} else throw e;
} finally {
	await sql.end();
}
