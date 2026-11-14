import { defineCustomClientStrategy } from '#lib/paraglide/runtime.js';
import { DEFAULT_LANGUAGE, LANGUAGE_COOKIE, LANGUAGES, usable } from '#lib/shared/languages.ts';

// The server writes the language cookie on every page (hooks.server.ts), only ever with a language it allows, so the
// page's scripts use the language the page was drawn in. Changing it goes through the account's settings and a reload, never this.
defineCustomClientStrategy('custom-obur', {
	getLocale: () =>
		usable(
			document.cookie
				.split(';')
				.map((c) => c.trim())
				.find((c) => c.startsWith(`${LANGUAGE_COOKIE}=`))
				?.slice(LANGUAGE_COOKIE.length + 1),
			LANGUAGES
		) ?? DEFAULT_LANGUAGE,
	setLocale: () => {}
});
