import type { LayoutServerLoad } from './$types';

export const load: LayoutServerLoad = ({ locals }) => {
	const s = locals.session;
	return {
		user: s?.kind === 'normal' ? { displayName: s.displayName, role: s.role } : undefined
	};
};
