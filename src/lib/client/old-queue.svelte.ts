// Entries left on this device by the offline support of versions before 2026-11-20 (docs/design.md, "Connection
// required", Removal). For one release only: at the app's start each waiting entry is sent once, in order, under the
// account that queued it, and the queue is deleted when nothing is left. An entry the server refuses stays listed on
// Today ("Couldn't save this entry") until the person keeps its calories, picks another food or discards it.
import { WRONG_ACCOUNT } from '../shared/account-data.ts';
import { accountHeaders } from './account.ts';
import { SAVE_TIMEOUT_MS } from './api.ts';
import { deleteQueue, openQueue, type QueuedOp, type Queue } from './offline/store.ts';

const QUEUE_PREFIX = 'obur-queue-';

/** The refused entries of the signed-in person's old queue. */
export const oldQueue = $state<{ refused: QueuedOp[] }>({ refused: [] });

let queue: Queue | undefined;
let sending: Promise<number> | undefined;

/** Whether this device has an old queue for this account, without making an empty one. */
async function hasQueue(ownerId: string): Promise<boolean> {
	const name = QUEUE_PREFIX + ownerId;
	if (indexedDB.databases) return (await indexedDB.databases()).some((d) => d.name === name);
	// No list (an older browser): opening would make an empty one, so look once and delete it if it is empty.
	return true;
}

/**
 * Sends what waits in this account's old queue and lists what the server refuses. Resolves with how many arrived
 * (the page then reloads its data). Stops at the first entry the server can't take now (no connection, signed out,
 * someone else signed in here) and tries again at the next start or return to the app.
 */
export function sendOldQueue(ownerId: string): Promise<number> {
	sending ??= (async () => {
		try {
			forgetOldNotes();
			if (!(await hasQueue(ownerId))) return 0;
			queue ??= await openQueue(ownerId, () => (queue = undefined));
			let sent = 0;
			for (const item of await queue.all()) {
				if (item.ownerId !== ownerId || item.status !== 'pending') continue;
				let response: Response;
				try {
					response = await fetch(item.path, {
						method: 'POST',
						credentials: 'same-origin',
						headers: { 'content-type': 'application/json', ...accountHeaders(ownerId) },
						body: JSON.stringify(item.body),
						signal: AbortSignal.timeout(SAVE_TIMEOUT_MS)
					});
				} catch {
					break;
				}
				const code = response.ok
					? undefined
					: ((await response.json().catch(() => ({}))) as { error?: string }).error;
				// Failing, signed out, or someone else signed in on this browser: try again later.
				if (response.status >= 500 || response.status === 401 || code === WRONG_ACCOUNT) break;
				// Saved, or deleted and purged long ago (410): nothing left to do. A refused note goes too: a later
				// note replaces it anyway.
				if (response.ok || response.status === 410 || item.preview.kind === 'note') {
					await queue.remove(item.seq!);
					if (response.ok) sent++;
					continue;
				}
				await queue.update({ ...item, status: 'review', error: code ?? 'error' });
			}
			await settle(ownerId);
			return sent;
		} catch {
			return 0;
		} finally {
			sending = undefined;
		}
	})();
	return sending;
}

/** Lists what is left; deletes the queue once nothing is. */
async function settle(ownerId: string) {
	const left = queue ? await queue.all() : [];
	oldQueue.refused = left.filter((i) => i.status === 'review' && i.preview.kind === 'diary');
	if (left.some((i) => i.status === 'pending' || i.preview.kind === 'diary')) return;
	// Water or weight the server refused can't be reviewed the way a food can: nothing to do but drop it.
	queue?.close();
	queue = undefined;
	await deleteQueue(ownerId);
}

/** Drops a refused entry (Discard, or once its calories are kept). */
export async function discardOld(ownerId: string, seq: number): Promise<void> {
	await queue?.remove(seq);
	await settle(ownerId);
}

/** Puts back an entry that was just discarded (Undo). */
export async function restoreOld(ownerId: string, op: QueuedOp): Promise<void> {
	queue ??= await openQueue(ownerId, () => (queue = undefined));
	await queue.put($state.snapshot(op) as QueuedOp);
	await settle(ownerId);
}

/**
 * Removes this account's old queue from the device (sign-out, account deletion). False when another tab of an older
 * version still holds it open; it is removed once that tab closes it.
 */
export async function clearOldQueue(ownerId: string): Promise<boolean> {
	queue?.close();
	queue = undefined;
	oldQueue.refused = [];
	return (await hasQueue(ownerId)) ? deleteQueue(ownerId) : true;
}

/** Notes older versions kept beside the queues: whose entries were waiting, and whose pages were saved. */
function forgetOldNotes() {
	try {
		localStorage.removeItem('obur:waiting');
		localStorage.removeItem('obur-cache-owner');
	} catch {
		// Storage unavailable: nothing was kept there either.
	}
}
