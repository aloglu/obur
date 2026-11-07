// See https://svelte.dev/docs/kit/types#app.d.ts
import type { SessionRecord } from '#lib/server/modules/auth/index.ts';

declare global {
	namespace App {
		interface Locals {
			/** The signed-in session, resolved from the cookie on every request. */
			session: SessionRecord | undefined;
			/** Theme chosen on this device (cookie); undefined follows the system setting. */
			theme: 'light' | 'dark' | undefined;
			palette: import('#lib/shared/themes.ts').PaletteId;
			appIcon: import('#lib/shared/app-icons.ts').AppIconId;
			timeFormat: 'device' | '24' | '12';
			/** The device's IANA time zone (cookie), used to decide which day "today" is. */
			zone: string;
		}
		interface Error {
			message: string;
		}
	}
}

export {};
