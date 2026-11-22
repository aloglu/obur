import { goals } from '#lib/server/goals.ts';
import { ACCOUNT_DATA } from '#lib/shared/account-data.ts';
import { DEFAULT_PREFERENCES, type Preferences } from '#lib/shared/preferences.ts';
import { DEFAULT_LANGUAGE, LANGUAGE_COOKIE, usable, type Language } from '#lib/shared/languages.ts';
import { config } from '#lib/server/config.ts';
import { regionUnits } from '#lib/shared/region-units.ts';
import { isValidZone } from '#lib/shared/diary-rules.ts';
import { body } from '#lib/server/body.ts';
import { getLocale } from '#lib/paraglide/runtime.js';
import type { LayoutServerLoad } from './$types';

export const load: LayoutServerLoad = async ({ locals, depends, cookies }) => {
	// Asked for again after every page change (the app layout, ACCOUNT_DATA), so a setting changed on another device
	// arrives without a reload, and the Home Screen icon link in the page's head is always the account's (docs/ui.md,
	// "App icon"). After, not during: a page never waits for this before it opens.
	depends(ACCOUNT_DATA);
	const s = locals.session;
	// This browser's own choices (cookies): what shows before signing in.
	const device: Preferences = {
		...DEFAULT_PREFERENCES,
		// The language this page is drawn in: the device's last one, else the phone's (hooks.server.ts).
		language: getLocale() as Language,
		themeMode: locals.theme ?? 'system',
		palette: locals.palette,
		appIcon: locals.appIcon,
		timeFormat: locals.timeFormat
	};
	let preferences = device;
	if (s?.kind === 'normal') {
		const stored = await goals.preferences(s.userId);
		// A new account (no settings and no records yet) starts with the units of where the device is, once its zone is
		// known (the sign-in pages send it). An older account that never saved a setting keeps what it shows.
		const zone = cookies.get('obur_zone');
		const start =
			!stored.saved && zone && isValidZone(zone) && (await body.firstDay(s.userId)) === null
				? regionUnits(zone)
				: {};
		const startChanged = (Object.keys(start) as (keyof typeof start)[]).some(
			(k) => start[k] !== DEFAULT_PREFERENCES[k]
		);
		const changed =
			startChanged ||
			(Object.keys(device) as (keyof Preferences)[]).some(
				(k) => device[k] !== DEFAULT_PREFERENCES[k]
			);
		// The first time, an account takes over the choices this browser already had (settings were per device
		// until 2026-11-07); after that the account decides everywhere.
		preferences =
			!stored.saved && changed
				? await goals.savePreferences(s.userId, {
						language: device.language,
						themeMode: device.themeMode,
						palette: device.palette,
						appIcon: device.appIcon,
						timeFormat: device.timeFormat,
						...start
					})
				: stored.preferences;
		// The page's head and <html> are written after this load, from these.
		locals.theme = preferences.themeMode === 'system' ? undefined : preferences.themeMode;
		locals.palette = preferences.palette;
		locals.appIcon = preferences.appIcon;
		locals.timeFormat = preferences.timeFormat;
		// The next page is drawn in the account's language; this one asks the browser to reload (+layout.svelte).
		const language = usable(preferences.language, config.languages) ?? DEFAULT_LANGUAGE;
		if (language !== device.language)
			cookies.set(LANGUAGE_COOKIE, language, {
				path: '/',
				maxAge: 60 * 60 * 24 * 365,
				sameSite: 'lax',
				httpOnly: false,
				secure: config.secureCookies
			});
	}
	return {
		user:
			s?.kind === 'normal' ? { id: s.userId, displayName: s.displayName, role: s.role } : undefined,
		theme: preferences.themeMode,
		palette: preferences.palette,
		appIcon: preferences.appIcon,
		timeFormat: preferences.timeFormat,
		language: usable(preferences.language, config.languages) ?? DEFAULT_LANGUAGE,
		/** The languages people can choose here; the choice shows only with more than one. */
		languages: config.languages,
		preferences
	};
};
