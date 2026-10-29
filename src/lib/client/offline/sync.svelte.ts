// Sends new entries now, or keeps them in the account's queue when the server cannot be reached, and sends them
// in creation order on load, reconnection and return to the foreground. Offline is inferred from failed requests,
// never from navigator.onLine (which reported "online" in Airplane Mode on the owner's iPhone in Phase 0).
import { ApiError } from '../api.ts';
import { deleteQueue, openQueue, type Preview, type Queue, type QueuedOp } from './store.ts';

/** Background sends can wait; a person tapping Save should not. */
const TIMEOUT_MS = 10_000;
const DIRECT_TIMEOUT_MS = 3_000;
const RETRY_MS = 30_000;
/** After a failed request, new entries go straight to the queue for this long (iOS can hang offline requests). */
const UNREACHABLE_HOLD_MS = 60_000;
let unreachableUntil = 0;
/** Refreshes the page after queued entries arrive (set by startSync). */
let sentHandler: (() => void) | undefined;

export const offline = $state<{
	ownerId: string | null;
	items: QueuedOp[];
	/** The session expired while items were waiting: sending pauses until the same person signs in. */
	authRequired: boolean;
	/** The page shows the service worker's saved copy rather than live data; refresh when the server is back. */
	cachedCopy: boolean;
}>({ ownerId: null, items: [], authRequired: false, cachedCopy: false });

let queue: Queue | undefined;
/** True while new entries skip the direct attempt because the server was unreachable a moment ago. */
export const recentlyUnreachable = () => Date.now() < unreachableUntil;
/** Resolves once the signed-in account's queue is open; submit() waits for it. */
let ready: Promise<void> | undefined;
let flushing: Promise<number> | undefined;
let timer: ReturnType<typeof setInterval> | undefined;
const listeners: (() => void)[] = [];

class Unreachable extends Error {}

/** POSTs JSON; throws Unreachable when the server cannot be reached or is failing, ApiError when it refuses. */
async function post(path: string, body: unknown, timeoutMs = TIMEOUT_MS): Promise<unknown> {
	const controller = new AbortController();
	const timeout = setTimeout(() => controller.abort(), timeoutMs);
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
		unreachableUntil = Date.now() + UNREACHABLE_HOLD_MS;
		throw new Unreachable();
	} finally {
		clearTimeout(timeout);
	}
	if (response.status >= 500) {
		unreachableUntil = Date.now() + UNREACHABLE_HOLD_MS;
		throw new Unreachable();
	}
	unreachableUntil = 0;
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
		sentHandler = onSent;
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
	sentHandler = undefined;
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
	// Try the server directly only when nothing is waiting and it was reachable recently; a timed-out attempt may
	// still arrive, which is harmless because the queued retry carries the same client ID.
	if (!waiting && !offline.authRequired && Date.now() >= unreachableUntil) {
		try {
			return { status: 'sent', data: (await post(path, body, DIRECT_TIMEOUT_MS)) as T };
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
	// Keep trying in the background (it also finds out when the server is back).
	if (waiting || Date.now() < unreachableUntil)
		void flush().then((sent) => sent > 0 && sentHandler?.());
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
