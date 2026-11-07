import { goals } from '#lib/server/goals.ts';
import type { LayoutServerLoad } from './$types';

export const load: LayoutServerLoad = async ({ locals }) => {
	const s = locals.session;
	// Signed in, the account's icon wins over this browser's cookie: an iPhone's Home Screen app and Safari keep
	// separate cookies, and the icon is chosen in one and added from the other. The page's head is written after
	// this load, so it uses this value.
	if (s?.kind === 'normal') {
		const icon = (await goals.profile(s.userId))?.appIcon;
		if (icon) locals.appIcon = icon;
	}
	return {
		user:
			s?.kind === 'normal' ? { id: s.userId, displayName: s.displayName, role: s.role } : undefined,
		theme: locals.theme ?? ('system' as const),
		palette: locals.palette,
		appIcon: locals.appIcon,
		timeFormat: locals.timeFormat
	};
};
