// Browser side of passkey ceremonies (SimpleWebAuthn). Server endpoints: /api/v1/auth/*.
import {
	browserSupportsWebAuthn,
	startAuthentication,
	startRegistration,
	type PublicKeyCredentialCreationOptionsJSON,
	type PublicKeyCredentialRequestOptionsJSON
} from '@simplewebauthn/browser';
import { m } from '#lib/paraglide/messages.js';
import { api, ApiError } from './api.ts';

const BASE = '/api/v1/auth';

type Options<T> = { options: T; challengeId: string };

export const passkeysSupported = () => browserSupportsWebAuthn();

/** Runs a registration ceremony: options endpoint, browser prompt, verify endpoint. */
export async function register<R>(
	step: string,
	optionsBody: Record<string, unknown>,
	verifyBody: Record<string, unknown>
): Promise<R> {
	const { options, challengeId } = await api<Options<PublicKeyCredentialCreationOptionsJSON>>(
		'POST',
		`${BASE}/${step}/options`,
		optionsBody
	);
	const response = await startRegistration({ optionsJSON: options });
	return api<R>('POST', `${BASE}/${step}/verify`, { ...verifyBody, challengeId, response });
}

async function authenticate(step: 'login' | 'reauth'): Promise<void> {
	const { options, challengeId } = await api<Options<PublicKeyCredentialRequestOptionsJSON>>(
		'POST',
		`${BASE}/${step}/options`,
		{}
	);
	const response = await startAuthentication({ optionsJSON: options });
	await api('POST', `${BASE}/${step}/verify`, { challengeId, response });
}

export const signIn = () => authenticate('login');

/** Runs an action; if the server wants a recent passkey check, performs it once and retries. */
export async function withRecentAuth<T>(action: () => Promise<T>): Promise<T> {
	try {
		return await action();
	} catch (e) {
		if (!(e instanceof ApiError) || e.code !== 'recent_auth_required') throw e;
		await authenticate('reauth');
		return action();
	}
}

/** A helpful default name for a new passkey. People can change it. */
export function suggestedLabel(): string {
	const ua = navigator.userAgent;
	if (/iPhone/.test(ua)) return 'iPhone';
	if (/iPad/.test(ua)) return 'iPad';
	if (/Android/.test(ua)) return 'Android phone';
	if (/Macintosh/.test(ua)) return 'Mac';
	if (/Windows/.test(ua)) return 'Windows PC';
	if (/Linux/.test(ua)) return 'Linux PC';
	return 'Passkey';
}

/** A message for a failed ceremony or API call. */
export function describeError(e: unknown): string {
	if (e instanceof DOMException && (e.name === 'NotAllowedError' || e.name === 'AbortError')) {
		return m.error_cancelled();
	}
	if (e instanceof ApiError) {
		switch (e.code) {
			case 'rate_limited':
				return m.error_rate_limited();
			case 'not_verified':
			case 'challenge_expired':
				return m.error_not_verified();
			case 'unknown_credential':
				return m.error_unknown_credential();
			case 'last_credential':
				return m.security_last_credential();
		}
	}
	return m.error_generic();
}

/** Reads a token from the URL fragment and removes it from the address bar and history. */
export function takeFragmentToken(): string | undefined {
	const token = location.hash.slice(1);
	if (token) history.replaceState(history.state, '', location.pathname + location.search);
	return /^[A-Za-z0-9_-]{20,100}$/.test(token) ? token : undefined;
}
