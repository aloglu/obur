import { redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';

// More is one page on phone and desktop now; old links still work.
export const load: PageServerLoad = () => {
	redirect(308, '/more');
};
