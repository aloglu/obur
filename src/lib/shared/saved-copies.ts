// How long this device keeps a saved copy of a page or an API answer for offline viewing (service-worker.ts). Every
// page opened is saved; without a limit the saved copies grow with use until sign-out.

/** Saved copies older than this are removed. The main tabs are saved again at every start, so they never expire. */
export const SAVED_COPY_DAYS = 60;
/** How often the service worker looks for expired copies. */
export const TRIM_EVERY_MS = 6 * 60 * 60 * 1000;

/**
 * Whether a saved answer, by its Date header, is past the limit. An answer without a readable date is kept: it can
 * still be useful offline, and the next visit replaces it with a dated one.
 */
export function savedCopyExpired(date: string | null, now: number): boolean {
	const at = date ? Date.parse(date) : NaN;
	return !Number.isNaN(at) && now - at > SAVED_COPY_DAYS * 24 * 60 * 60 * 1000;
}
