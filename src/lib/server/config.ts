// Server configuration derived from validated environment variables (src/env.ts).
import {
	LABELS_URL,
	OBUR_PREVIEW_LANGUAGES,
	PUBLIC_ORIGIN,
	SPEECH_URL,
	VAPID_PUBLIC_KEY,
	WEBAUTHN_RP_ID,
	WEBAUTHN_RP_NAME
} from '$app/env/private';
import { enabledLanguages, type Language } from '#lib/shared/languages.ts';

export interface ServerConfig {
	origin: string;
	rpId: string;
	rpName: string;
	secureCookies: boolean;
	/** The speech service, or null when Speak is switched off. */
	speechUrl: string | null;
	/** The OCR service, or null when label scanning is switched off. */
	ocrUrl: string | null;
	/** The Web Push public key, or null when reminders are switched off. */
	pushKey: string | null;
	/** The interface languages people can use here (released ones and any in preview; shared/languages.ts). */
	languages: readonly Language[];
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
		speechUrl: SPEECH_URL ?? null,
		ocrUrl: LABELS_URL ?? null,
		pushKey: VAPID_PUBLIC_KEY ?? null,
		languages: enabledLanguages(OBUR_PREVIEW_LANGUAGES)
	};
}

export const config = load();
