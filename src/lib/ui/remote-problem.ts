// When a company's model gave no answer (docs/ui.md, "Your own AI key for Speak and Scan"): one card saying what
// happened, one button that fixes it, then Type it instead. Shared by Speak and Scan.
import { m } from '#lib/paraglide/messages.js';
import {
	PROVIDER_NAME,
	type Feature,
	type Provider,
	type RemoteError
} from '#lib/shared/remote-models.ts';

export interface RemoteProblem {
	title: string;
	line: string;
	tone: 'warn' | 'bad' | 'info';
	/** What the main button does: open the settings page, start over, or send the same recording or photo again. */
	fix: 'settings' | 'again' | 'retry';
	fixLabel: string;
}

export const REMOTE_ERRORS: readonly string[] = [
	'key_refused',
	'no_credit',
	'provider_busy',
	'provider_unavailable',
	'key_missing'
] satisfies RemoteError[];

export function remoteProblem(
	code: RemoteError,
	provider: Provider,
	feature: Feature
): RemoteProblem {
	const name = PROVIDER_NAME[provider];
	const speak = feature === 'speak';
	switch (code) {
		case 'key_refused':
			return {
				title: m.remote_key_refused({ provider: name }),
				line: m.remote_key_refused_line({ provider: name }),
				tone: 'bad',
				fix: 'settings',
				fixLabel: m.remote_replace_key()
			};
		case 'key_missing':
			return {
				title: m.remote_key_missing({ provider: name }),
				line: m.remote_key_missing_line(),
				tone: 'warn',
				fix: 'settings',
				fixLabel: m.remote_open_settings()
			};
		case 'no_credit':
			return {
				title: m.remote_no_credit({ provider: name }),
				line: speak
					? m.remote_no_credit_speak_line({ provider: name })
					: m.remote_no_credit_scan_line({ provider: name }),
				tone: 'warn',
				fix: 'again',
				fixLabel: speak ? m.remote_record_again() : m.remote_photo_again()
			};
		default:
			return {
				title: m.remote_down({ provider: name }),
				line: speak ? m.remote_down_speak_line() : m.remote_down_scan_line(),
				tone: 'info',
				fix: 'retry',
				fixLabel: m.remote_try_again()
			};
	}
}
