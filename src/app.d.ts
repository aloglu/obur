// See https://svelte.dev/docs/kit/types#app.d.ts
import type { SessionRecord } from '#lib/server/modules/auth/index.ts';

declare global {
	namespace App {
		interface Locals {
			/** The signed-in session, resolved from the cookie on every request. */
			session: SessionRecord | undefined;
		}
		interface Error {
			message: string;
		}
	}
}

export {};
