import { redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';

// Already signed in normally (a bookmark, the back button, a reload after recovery): straight to Today.
export const load: PageServerLoad = ({ locals }) => {
	if (locals.session?.kind === 'normal') redirect(303, '/');
	return { recovering: locals.session?.kind === 'recovery' };
};
