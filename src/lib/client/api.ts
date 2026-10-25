// JSON calls to the app's own API. The browser adds the Origin header the server checks for state changes.
export class ApiError extends Error {
	constructor(
		readonly code: string,
		readonly status: number
	) {
		super(code);
	}
}

export async function api<T = unknown>(
	method: 'GET' | 'POST' | 'PUT',
	path: string,
	body?: unknown
): Promise<T> {
	const response = await fetch(path, {
		method,
		credentials: 'same-origin',
		headers: body === undefined ? undefined : { 'content-type': 'application/json' },
		body: body === undefined ? undefined : JSON.stringify(body)
	});
	const data = (await response.json().catch(() => ({}))) as { error?: string; message?: string };
	if (!response.ok) throw new ApiError(data.error ?? data.message ?? 'error', response.status);
	return data as T;
}
