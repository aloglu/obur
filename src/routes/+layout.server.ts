import type { LayoutServerLoad } from './$types';

export const load: LayoutServerLoad = ({ locals }) => {
	const s = locals.session;
	return {
		user:
			s?.kind === 'normal' ? { id: s.userId, displayName: s.displayName, role: s.role } : undefined,
		theme: locals.theme ?? ('system' as const),
		palette: locals.palette
	};
};
