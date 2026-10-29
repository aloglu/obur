// Sends new entries now, or keeps them in the account's queue when the server cannot be reached, and sends them
// in creation order on load, reconnection and return to the foreground. Offline is inferred from failed requests,
// never from navigator.onLine (which reported "online" in Airplane Mode on the owner's iPhone in Phase 0).
import { ApiError } from '../api.ts';
import { deleteQueue, openQueue, type Preview, type Queue, type QueuedOp } from './store.ts';

const TIMEOUT_MS = 10_000;
const RETRY_MS = 30_000;

export const offline = $state<{
	ownerId: string | null;
	items: QueuedOp[];
	/** The session expired while items were waiting: sending pauses until the same person signs in. */
	authRequired: boolean;
	/** The page shows the service worker's saved copy rather than live data; refresh when the server is back. */
	cachedCopy: boolean;
}>({ ownerId: null, items: [], authRequired: false, cachedCopy: false });

let queue: Queue | undefined;
/** Resolves once the signed-in account's queue is open; submit() waits for it. */
let ready: Promise<void> | undefined;
let flushing: Promise<number> | undefined;
let timer: ReturnType<typeof setInterval> | undefined;
const listeners: (() => void)[] = [];

class Unreachable extends Error {}

/** POSTs JSON; throws Unreachable when the server cannot be reached or is failing, ApiError when it refuses. */
async function post(path: string, body: unknown): Promise<unknown> {
	const controller = new AbortController();
	const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS);
	let response: Response;
	try {
		response = await fetch(path, {
			method: 'POST',
			credentials: 'same-origin',
			headers: { 'content-type': 'application/json' },
			body: JSON.stringify(body),
			signal: controller.signal
		});
	} catch {
		throw new Unreachable();
	} finally {
		clearTimeout(timeout);
	}
	if (response.status >= 500) throw new Unreachable();
	const data = (await response.json().catch(() => ({}))) as { error?: string };
	if (!response.ok) throw new ApiError(data.error ?? 'error', response.status);
	return data;
}

async function refresh() {
	offline.items = queue ? await queue.all() : [];
}

/** Opens this account's queue and starts sending. Call once the signed-in person is known. */
export function startSync(ownerId: string, onSent: () => void): Promise<void> {
	if (offline.ownerId === ownerId && ready) return ready;
	stopSync();
	offline.ownerId = ownerId;
	offline.authRequired = false;
	ready = (async () => {
		await forgetOtherAccountsPages(ownerId);
		queue = await openQueue(ownerId);
		await refresh();
		// Refresh when something arrived or the page shows a saved copy; otherwise reloading would only fail.
		const kick = () => void flush().then((sent) => (sent > 0 || offline.cachedCopy) && onSent());
		const onVisible = () => document.visibilityState === 'visible' && kick();
		const onMessage = (event: MessageEvent) => {
			if (event.data?.type === 'obur:page-data') offline.cachedCopy = event.data.copy === 'cached';
		};
		addEventListener('online', kick);
		document.addEventListener('visibilitychange', onVisible);
		navigator.serviceWorker?.addEventListener('message', onMessage);
		listeners.push(
			() => removeEventListener('online', kick),
			() => document.removeEventListener('visibilitychange', onVisible),
			() => navigator.serviceWorker?.removeEventListener('message', onMessage)
		);
		timer = setInterval(
			() => (offline.cachedCopy || offline.items.some((i) => i.status === 'pending')) && kick(),
			RETRY_MS
		);
		kick();
	})();
	return ready;
}

export function stopSync() {
	listeners.splice(0).forEach((off) => off());
	clearInterval(timer);
	queue?.close();
	queue = undefined;
	ready = undefined;
	offline.ownerId = null;
	offline.items = [];
	offline.cachedCopy = false;
}

/**
 * Sends a new entry, or queues it if the server cannot be reached. Entries already waiting go first, so creation
 * order is kept. A refusal from a reachable server (validation, conflict) is thrown to the caller.
 */
export async function submit<T>(
	path: string,
	body: Record<string, unknown> & { id: string },
	preview: Preview
): Promise<{ status: 'sent'; data: T } | { status: 'queued' }> {
	await ready;
	if (!queue || !offline.ownerId) throw new Error('Sync not started');
	const waiting = offline.items.some((i) => i.status === 'pending');
	if (!waiting && !offline.authRequired) {
		try {
			return { status: 'sent', data: (await post(path, body)) as T };
		} catch (e) {
			if (!(e instanceof Unreachable)) throw e;
		}
	}
	await queue.add({
		id: body.id,
		ownerId: offline.ownerId,
		path,
		body,
		preview,
		// eslint-disable-next-line svelte/prefer-svelte-reactivity -- converted to a string at once, not reactive state
		createdAt: new Date().toISOString(),
		attempts: 0,
		status: 'pending'
	});
	await refresh();
	if (waiting) void flush();
	return { status: 'queued' };
}

/**
 * Sends waiting items in order and resolves with how many arrived. Stops at the first unreachable attempt; a
 * refused item is kept for review.
 */
export function flush(): Promise<number> {
	flushing ??= (async () => {
		let sent = 0;
		try {
			// Plain copies: IndexedDB cannot store the reactive proxies in offline.items.
			const waiting = $state.snapshot(offline.items).filter((i) => i.status === 'pending');
			for (const item of waiting) {
				if (!queue || item.ownerId !== offline.ownerId) return sent;
				item.attempts += 1;
				try {
					await post(item.path, item.body);
					await queue.remove(item.seq!);
					sent += 1;
				} catch (e) {
					if (e instanceof Unreachable) {
						await queue.put(item);
						return sent;
					}
					const err = e as ApiError;
					if (err.status === 410) {
						// Sent long ago, then deleted and purged from the trash: nothing left to do.
						await queue.remove(item.seq!);
						continue;
					}
					if (err.status === 401) {
						offline.authRequired = true;
						return sent;
					}
					await queue.put({ ...item, status: 'review', error: err.code });
				}
			}
			offline.authRequired = false;
			return sent;
		} finally {
			await refresh();
			flushing = undefined;
		}
	})();
	return flushing;
}

/** Drops a local, unsent entry. */
export async function discard(seq: number): Promise<void> {
	await queue?.remove(seq);
	await refresh();
}

/** Removes this device's copy of an account's local data: its queue and cached pages and API responses. */
export async function clearDeviceData(ownerId: string): Promise<void> {
	stopSync();
	await deleteQueue(ownerId);
	if ('caches' in globalThis) {
		for (const key of await caches.keys())
			if (key.startsWith('obur-data')) await caches.delete(key);
	}
}

/** Cached pages belong to whoever was signed in; clear them when a different person signs in on this device. */
async function forgetOtherAccountsPages(ownerId: string): Promise<void> {
	let previous: string | null = null;
	try {
		previous = localStorage.getItem('obur-cache-owner');
		localStorage.setItem('obur-cache-owner', ownerId);
	} catch {
		// Storage unavailable (private mode): clearing every time is the safe fallback.
	}
	if (previous !== ownerId && 'caches' in globalThis) {
		for (const key of await caches.keys())
			if (key.startsWith('obur-data')) await caches.delete(key);
	}
}
