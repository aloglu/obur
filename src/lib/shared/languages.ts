// The interface language (docs/design.md, "Interface language"): one per person, kept with the account's settings
// and mirrored in a cookie so a page renders in it at once. Before signing in, the device's last language, else the
// phone's. Typed food names, brands and notes are never translated.

/** Every language the app knows how to store (an archive from a later version may carry any of them). */
export const LANGUAGES = ['en', 'tr'] as const;
export type Language = (typeof LANGUAGES)[number];

/**
 * The languages people can use. Turkish joins once its text is complete and the owner has reviewed it; until then
 * nothing shows or picks it, and a saved choice of it falls back to English.
 */
export const ENABLED_LANGUAGES: readonly [Language, ...Language[]] = ['en'];

export const DEFAULT_LANGUAGE: Language = 'en';

/** The cookie that mirrors the language, read before the page draws (server) and by the page itself (client). */
export const LANGUAGE_COOKIE = 'obur_lang';

export const isLanguage = (value: unknown): value is Language =>
	typeof value === 'string' && (LANGUAGES as readonly string[]).includes(value);

/** The language to show for a stored or saved choice: itself when enabled, else the default. */
export function usable(
	value: unknown,
	enabled: readonly Language[] = ENABLED_LANGUAGES
): Language | undefined {
	return isLanguage(value) && enabled.includes(value) ? value : undefined;
}

/** The phone's preferred language among the enabled ones, from an Accept-Language header ("tr-TR,tr;q=0.9,en;q=0.8"). */
export function fromAcceptLanguage(
	header: string | null | undefined,
	enabled: readonly Language[] = ENABLED_LANGUAGES
): Language | undefined {
	if (!header) return undefined;
	const wanted = header
		.split(',')
		.map((part, i) => {
			const [tag, ...params] = part.trim().split(';');
			const q = params.map((p) => p.trim()).find((p) => p.startsWith('q='));
			const weight = q ? Number(q.slice(2)) : 1;
			return {
				lang: tag.trim().toLowerCase().split('-')[0],
				weight: Number.isFinite(weight) ? weight : 0,
				i
			};
		})
		.filter((w) => w.lang && w.weight > 0)
		.sort((a, b) => b.weight - a.weight || a.i - b.i);
	for (const w of wanted) {
		const found = usable(w.lang, enabled);
		if (found) return found;
	}
	return undefined;
}

/** What a request shows: the cookie (the account's or the device's last language), else the phone's, else English. */
export function pickLanguage(
	cookie: string | undefined,
	acceptLanguage: string | null | undefined,
	enabled: readonly Language[] = ENABLED_LANGUAGES
): Language {
	return usable(cookie, enabled) ?? fromAcceptLanguage(acceptLanguage, enabled) ?? DEFAULT_LANGUAGE;
}
