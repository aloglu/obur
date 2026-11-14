// Tests only: runs `fn` as if the page were drawn in `locale`, then restores the usual resolution.
import { getLocale, overwriteGetLocale } from '#lib/paraglide/runtime.js';

export function overwriteLocale<T>(locale: 'en' | 'tr', fn: () => T): T {
	const usual = getLocale;
	overwriteGetLocale(() => locale);
	try {
		return fn();
	} finally {
		overwriteGetLocale(usual);
	}
}
