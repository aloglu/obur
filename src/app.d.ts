// See https://svelte.dev/docs/kit/types#app.d.ts
import type { SessionRecord } from '#lib/server/modules/auth/index.ts';

declare global {
	namespace App {
		interface Locals {
			/** The signed-in session, resolved from the cookie on every request. */
			session: SessionRecord | undefined;
			/** Theme chosen on this device (cookie); undefined follows the system setting. */
			theme: 'light' | 'dark' | undefined;
			/** The device's IANA time zone (cookie), used to decide which day "today" is. */
			zone: string;
		}
		interface Error {
			message: string;
		}
	}
}

export {};
