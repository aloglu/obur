import { redirect } from '@sveltejs/kit';
import { auth } from '#lib/server/auth.ts';
import { asJson } from '#lib/server/as-json.ts';
import { portability } from '#lib/server/portability.ts';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals }) => {
	if (locals.session?.role !== 'admin') redirect(303, '/');
	const session = locals.session;
	const [invites, members] = await Promise.all([
		// The lists arrive with the page (and so are prepared with it), never fetched after it opens.
		auth.listInvites(session),
		portability.members(session.userId)
	]);
	return asJson({ invites, members });
};
