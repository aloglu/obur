// Server configuration derived from validated environment variables (src/env.ts).
import { PUBLIC_ORIGIN, SPEECH_URL, WEBAUTHN_RP_ID, WEBAUTHN_RP_NAME } from '$app/env/private';

export interface ServerConfig {
	origin: string;
	rpId: string;
	rpName: string;
	secureCookies: boolean;
	/** The speech service, or null when Speak is switched off. */
	speechUrl: string | null;
}

/** The passkey domain must be the origin's host or a parent domain of it. */
export function rpIdMatchesOrigin(rpId: string, origin: string): boolean {
	const host = new URL(origin).hostname.toLowerCase();
	const id = rpId.toLowerCase();
	return host === id || host.endsWith(`.${id}`);
}

function load(): ServerConfig {
	if (!rpIdMatchesOrigin(WEBAUTHN_RP_ID, PUBLIC_ORIGIN)) {
		throw new Error('WEBAUTHN_RP_ID must equal the PUBLIC_ORIGIN host or a parent domain of it');
	}
	return {
		origin: PUBLIC_ORIGIN,
		rpId: WEBAUTHN_RP_ID.toLowerCase(),
		rpName: WEBAUTHN_RP_NAME ?? 'obur',
		secureCookies: new URL(PUBLIC_ORIGIN).protocol === 'https:',
		speechUrl: SPEECH_URL ?? null
	};
}

export const config = load();
