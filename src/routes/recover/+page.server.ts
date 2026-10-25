import type { PageServerLoad } from './$types';

export const load: PageServerLoad = ({ locals }) => ({
	recovering: locals.session?.kind === 'recovery'
});
