// Prints a one-time setup link for the first admin. Usage: npm run admin:setup-link
import postgres from 'postgres';
import { issueSetupLink, OperatorError } from '../src/lib/server/modules/auth/operator.ts';

const url = process.env.DATABASE_MIGRATOR_URL;
const origin = process.env.PUBLIC_ORIGIN;
if (!url || !origin) throw new Error('DATABASE_MIGRATOR_URL and PUBLIC_ORIGIN must be set');

const sql = postgres(url, { max: 1, onnotice: () => {} });
try {
	const link = await issueSetupLink(sql, new URL(origin).origin);
	console.log('Open this link on the device you will use first (valid for 24 hours, works once):');
	console.log(link);
} catch (e) {
	if (e instanceof OperatorError) {
		console.error(e.message);
		process.exitCode = 1;
	} else throw e;
} finally {
	await sql.end();
}
