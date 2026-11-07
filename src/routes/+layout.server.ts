import { goals } from '#lib/server/goals.ts';
import { DEFAULT_PREFERENCES, type Preferences } from '#lib/shared/preferences.ts';
import type { LayoutServerLoad } from './$types';

export const load: LayoutServerLoad = async ({ locals, url }) => {
	// Runs again on every page change, so a setting changed on another device arrives without a reload, and the
	// Home Screen icon link in the page's head is always the account's (docs/ui.md, "App icon").
	void url.pathname;
	const s = locals.session;
	// This browser's own choices (cookies): what shows before signing in.
	const device: Preferences = {
		...DEFAULT_PREFERENCES,
		themeMode: locals.theme ?? 'system',
		palette: locals.palette,
		appIcon: locals.appIcon,
		timeFormat: locals.timeFormat
	};
	let preferences = device;
	if (s?.kind === 'normal') {
		const stored = await goals.preferences(s.userId);
		const changed = (Object.keys(device) as (keyof Preferences)[]).some(
			(k) => device[k] !== DEFAULT_PREFERENCES[k]
		);
		// The first time, an account takes over the choices this browser already had (settings were per device
		// until 2026-11-07); after that the account decides everywhere.
		preferences =
			!stored.saved && changed
				? await goals.savePreferences(s.userId, {
						themeMode: device.themeMode,
						palette: device.palette,
						appIcon: device.appIcon,
						timeFormat: device.timeFormat
					})
				: stored.preferences;
		// The page's head and <html> are written after this load, from these.
		locals.theme = preferences.themeMode === 'system' ? undefined : preferences.themeMode;
		locals.palette = preferences.palette;
		locals.appIcon = preferences.appIcon;
		locals.timeFormat = preferences.timeFormat;
	}
	return {
		user:
			s?.kind === 'normal' ? { id: s.userId, displayName: s.displayName, role: s.role } : undefined,
		theme: preferences.themeMode,
		palette: preferences.palette,
		appIcon: preferences.appIcon,
		timeFormat: preferences.timeFormat,
		preferences
	};
};
