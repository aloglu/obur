import { redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';

// Settings live under More (More → Settings) on phone and desktop; old links still work.
export const load: PageServerLoad = () => {
	redirect(308, '/more/settings');
};
