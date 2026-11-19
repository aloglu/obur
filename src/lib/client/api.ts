// JSON calls to the app's own API. The browser adds the Origin header the server checks for state changes.
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

export async function api<T = unknown>(
	method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE',
	path: string,
	body?: unknown
): Promise<T> {
	const response = await fetch(path, {
		method,
		credentials: 'same-origin',
		headers: {
			...(method === 'GET' ? {} : accountHeaders()),
			...(body === undefined ? {} : { 'content-type': 'application/json' })
		},
		body: body === undefined ? undefined : JSON.stringify(body)
	});
	const data = (await response.json().catch(() => ({}))) as { error?: string; message?: string };
	if (!response.ok) {
		const code = data.error ?? data.message ?? 'error';
		wrongAccount(code, response.status);
		throw new ApiError(code, response.status);
	}
	return data as T;
}
