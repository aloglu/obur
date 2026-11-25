// JSON calls to the app's own API. The browser adds the Origin header the server checks for state changes.
// obur needs a connection (docs/design.md, "Connection required"): a call the server can't answer throws
// NoConnection, and nothing is kept on the device to send later.
import { accountHeaders, wrongAccount } from './account.ts';

export class ApiError extends Error {
	constructor(
		readonly code: string,
		readonly status: number,
		readonly detail?: string
	) {
		super(code);
	}
}

/** The server couldn't be reached, or didn't answer in time. */
export class NoConnection extends ApiError {
	constructor() {
		super('no_connection', 0);
	}
}

/** A new record waits this long for the server: a slow connection still saves (it used to be queued after 3 s). */
export const SAVE_TIMEOUT_MS = 10_000;
/** After a request found no connection, background work waits this long before asking the server again. */
const UNREACHABLE_HOLD_MS = 60_000;
let unreachableUntil = 0;

/** True for a minute after a request found no connection (iOS can leave requests hanging without one). */
export const recentlyUnreachable = () => Date.now() < unreachableUntil;

/** A quick check that the server answers, bypassing every cache. */
export async function serverReachable(timeoutMs = 3000): Promise<boolean> {
	if (recentlyUnreachable()) return false;
	try {
		const response = await fetch('/_app/version.json', {
			cache: 'no-store',
			signal: AbortSignal.timeout(timeoutMs)
		});
		return response.ok;
	} catch {
		unreachableUntil = Date.now() + UNREACHABLE_HOLD_MS;
		return false;
	}
}

export async function api<T = unknown>(
	method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE',
	path: string,
	body?: unknown,
	/** Gives up after this long with NoConnection; without it, waits as long as the browser does. */
	timeoutMs?: number
): Promise<T> {
	let response: Response;
	try {
		// eslint-disable-next-line obur/account-header -- every method but GET gets accountHeaders() below
		response = await fetch(path, {
			method,
			credentials: 'same-origin',
			headers: {
				...(method === 'GET' ? {} : accountHeaders()),
				...(body === undefined ? {} : { 'content-type': 'application/json' })
			},
			body: body === undefined ? undefined : JSON.stringify(body),
			signal: timeoutMs ? AbortSignal.timeout(timeoutMs) : undefined
		});
	} catch {
		unreachableUntil = Date.now() + UNREACHABLE_HOLD_MS;
		throw new NoConnection();
	}
	unreachableUntil = 0;
	const data = (await response.json().catch(() => ({}))) as { error?: string; message?: string };
	if (!response.ok) {
		const code = data.error ?? data.message ?? 'error';
		wrongAccount(code, response.status);
		throw new ApiError(code, response.status);
	}
	return data as T;
}

/**
 * Saves a new record, once. Its client-made `id` makes a repeated save count once (the server answers it as saved),
 * so after NoConnection the person can simply tap Save again.
 */
export const save = <T = unknown>(path: string, body: Record<string, unknown> & { id: string }) =>
	api<T>('POST', path, body, SAVE_TIMEOUT_MS);

/**
 * The ID for a new record, the same for as long as what is saved stays the same: tapping Save again after
 * NoConnection resends the same record (counted once), while a changed amount is a new record. After a save that
 * succeeded, call `saved()`: the same content again is then a new record (a second glass of water of the same size,
 * 2026-11-25 audit).
 */
export function recordIds(): ((content: unknown) => string) & { saved: () => void } {
	let last: { key: string; id: string } | undefined;
	const idFor = (content: unknown) => {
		const key = JSON.stringify(content);
		if (last?.key !== key) last = { key, id: crypto.randomUUID() };
		return last.id;
	};
	return Object.assign(idFor, { saved: () => (last = undefined) });
}
