import { redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';

// Already signed in (a bookmark, the back button, a second tab): straight to Today, never a second passkey prompt.
export const load: PageServerLoad = ({ locals }) => {
	if (locals.session?.kind === 'normal') redirect(303, '/');
};
