import { auth } from '#lib/server/auth.ts';
import { asJson } from '#lib/server/as-json.ts';
import type { PageServerLoad } from './$types';

// The passkeys and how many recovery codes remain arrive with the page, never fetched after it opens.
export const load: PageServerLoad = async ({ locals }) => {
	const session = locals.session!;
	const [credentials, remaining] = await Promise.all([
		auth.listCredentials(session),
		auth.recoveryCodeCount(session)
	]);
	return asJson({ credentials, remaining });
};
