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
	VAPID_PUBLIC_KEY: {
		description:
			'Web Push public key (npm run push:keys). Unset: reminders are off. The worker also needs VAPID_PRIVATE_KEY and VAPID_SUBJECT.',
		schema: (value) => {
			if (!value) return null;
			if (!/^[A-Za-z0-9_-]{80,100}$/.test(value))
				throw new Error('VAPID_PUBLIC_KEY must be a base64url key');
			return value;
		}
	},
	SPEECH_URL: {
		description:
			'Base URL of the speech service (obur-speech), e.g. http://obur-speech:8000. Unset: Speak is off.',
		schema: (value) => {
			if (!value) return null;
			const url = new URL(value);
			if (url.protocol !== 'http:' && url.protocol !== 'https:')
				throw new Error('SPEECH_URL must be http(s)');
			return url.origin;
		}
	},
	LABELS_URL: {
		description:
			'Base URL of the label-reading service (obur-labels), e.g. http://obur-labels:8000. Unset: label scanning is off.',
		schema: (value) => {
			if (!value) return null;
			const url = new URL(value);
			if (url.protocol !== 'http:' && url.protocol !== 'https:')
				throw new Error('LABELS_URL must be http(s)');
			return url.origin;
		}
	},
	OBUR_PREVIEW_LANGUAGES: {
		description:
			'Interface languages to try before their release, comma-separated (only "tr" exists). Unset: only released languages.',
		schema: (value) => {
			if (!value) return null;
			const list = value
				.split(',')
				.map((x) => x.trim())
				.filter(Boolean);
			for (const lang of list)
				if (lang !== 'tr') throw new Error('OBUR_PREVIEW_LANGUAGES only knows "tr"');
			return list.join(',');
		}
	},
	OBUR_SECRETS_KEY: {
		description:
			"64 hex characters that encrypt people's own AI keys (made by the obur container on first start). Unset: personal keys are off.",
		schema: (value) => {
			if (!value) return null;
			if (!/^[0-9a-f]{64}$/i.test(value))
				throw new Error('OBUR_SECRETS_KEY must be 64 hex characters');
			return value;
		}
	},
	AI_PROVIDER_TEST_URL: {
		description:
			'Browser tests only: a stand-in for OpenAI and OpenRouter. Never set it on a real server.',
		schema: (value) => {
			if (!value) return null;
			const url = new URL(value);
			if (url.protocol !== 'http:' && url.protocol !== 'https:')
				throw new Error('AI_PROVIDER_TEST_URL must be http(s)');
			return url.origin;
		}
	},
	UPDATES_TEST_URL: {
		description:
			'Browser tests only: a stand-in for the list of published versions. Never set it on a real server.',
		schema: (value) => {
			if (!value) return null;
			const url = new URL(value);
			if (url.protocol !== 'http:' && url.protocol !== 'https:')
				throw new Error('UPDATES_TEST_URL must be http(s)');
			return url.origin;
		}
	},
	OBUR_STATUS_DIR: {
		description:
			'Folder with the backup status file and the restore mark, written by the backup tools (read-only here).',
		schema: (value) => value || null
	}
});
