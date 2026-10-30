import { defineEnvVars } from '@sveltejs/kit/env';
import * as v from 'valibot';

// Validated when the app starts. Real hostnames live only in each installation's .env (CLAUDE.md).
export const variables = defineEnvVars({
	DATABASE_URL: {
		description: 'Connection string for the runtime application role (obur_app).',
		schema: v.pipe(v.string(), v.url())
	},
	PUBLIC_ORIGIN: {
		description: 'Public origin people use, e.g. https://obur.example.com (no path).',
		schema: v.pipe(
			v.string(),
			v.url(),
			v.check((value) => {
				const url = new URL(value);
				const local = url.hostname === 'localhost' || url.hostname === '127.0.0.1';
				return (url.protocol === 'https:' || local) && url.pathname === '/' && !url.search;
			}, 'PUBLIC_ORIGIN must be an https origin without a path (http allowed only for localhost)'),
			v.transform((value) => new URL(value).origin)
		)
	},
	WEBAUTHN_RP_ID: {
		description: 'Passkey domain: the origin host or a parent domain of it, e.g. example.com.',
		schema: v.pipe(v.string(), v.regex(/^[a-z0-9.-]+$/i, 'WEBAUTHN_RP_ID must be a bare host name'))
	},
	WEBAUTHN_RP_NAME: {
		description: 'Name shown by passkey prompts.',
		schema: (value) => value || 'obur'
	},
	SPEECH_URL: {
		description:
			'Base URL of the speech service on the internal network, e.g. http://speech:8000. Unset: Speak is off.',
		schema: (value) => {
			if (!value) return null;
			const url = new URL(value);
			if (url.protocol !== 'http:' && url.protocol !== 'https:')
				throw new Error('SPEECH_URL must be http(s)');
			return url.origin;
		}
	},
	OBUR_STATUS_DIR: {
		description:
			'Folder with the backup status file written by the database container (read-only here).',
		schema: (value) => value || null
	}
});
