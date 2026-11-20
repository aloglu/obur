// The storage of the offline queue that versions before 2026-11-20 kept: one IndexedDB database per account. Read
// only by client/old-queue.svelte.ts, for one release, to send what is left (docs/design.md, "Connection required").

export type Preview =
	| {
			kind: 'diary';
			localDate: string;
			meal: 'breakfast' | 'lunch' | 'dinner' | 'snacks';
			name: string;
			quantity: string;
			kcal: number | null;
	  }
	| { kind: 'water'; localDate: string; ml: number }
	| { kind: 'weight'; localDate: string; kg: number }
	| { kind: 'note'; localDate: string; text: string };

export interface QueuedOp {
	/** Auto-increment key: the order in which entries were created. */
	seq?: number;
	/** The record's client-generated ID; resending it is idempotent on the server. */
	id: string;
	ownerId: string;
	path: string;
	/** The immutable request body, including the ID and captured date/zone. */
	body: Record<string, unknown>;
	preview: Preview;
	createdAt: string;
	attempts: number;
	/** pending: will be sent; review: the server refused it and the person should look at it. */
	status: 'pending' | 'review';
	error?: string;
}

const dbName = (ownerId: string) => `obur-queue-${ownerId}`;

function request<T>(req: IDBRequest<T>): Promise<T> {
	return new Promise((resolve, reject) => {
		req.onsuccess = () => resolve(req.result);
		req.onerror = () => reject(req.error);
	});
}

/** `onClosed`: another tab removed this queue (sign-out there); this connection no longer works. */
export async function openQueue(ownerId: string, onClosed?: () => void) {
	const db = await new Promise<IDBDatabase>((resolve, reject) => {
		const req = indexedDB.open(dbName(ownerId), 1);
		req.onupgradeneeded = () =>
			req.result.createObjectStore('ops', { keyPath: 'seq', autoIncrement: true });
		req.onsuccess = () => resolve(req.result);
		req.onerror = () => reject(req.error);
	});
	// Another tab is removing this queue (sign-out there): let it, rather than block it (2026-11-20 audit).
	db.onversionchange = () => {
		db.close();
		onClosed?.();
	};
	const store = (mode: IDBTransactionMode) => db.transaction('ops', mode).objectStore('ops');
	return {
		add: (op: QueuedOp) => request(store('readwrite').add(op)) as Promise<number>,
		put: (op: QueuedOp) => request(store('readwrite').put(op)),
		/**
		 * Updates an item only if it is still queued, in one transaction: one discarded (in this tab or another) while
		 * it was being sent stays discarded.
		 */
		update: (op: QueuedOp) =>
			new Promise<void>((resolve, reject) => {
				const tx = db.transaction('ops', 'readwrite');
				const ops = tx.objectStore('ops');
				const existing = ops.getKey(op.seq!);
				existing.onsuccess = () => {
					if (existing.result !== undefined) ops.put(op);
				};
				tx.oncomplete = () => resolve();
				tx.onerror = () => reject(tx.error);
			}),
		remove: (seq: number) => request(store('readwrite').delete(seq)),
		has: async (seq: number) => (await request(store('readonly').getKey(seq))) !== undefined,
		/** All items in creation order. */
		all: async () =>
			((await request(store('readonly').getAll())) as QueuedOp[]).sort((a, b) => a.seq! - b.seq!),
		close: () => db.close()
	};
}

export type Queue = Awaited<ReturnType<typeof openQueue>>;

/**
 * Removes an account's queue from this device (sign-out with nothing pending, or after discarding). Resolves false
 * when it could not be removed: another tab (of an older version) kept it open, or the browser refused. A blocked
 * removal still happens once that tab closes it.
 */
export function deleteQueue(ownerId: string, waitMs = 5000): Promise<boolean> {
	return new Promise((resolve) => {
		const req = indexedDB.deleteDatabase(dbName(ownerId));
		const timer = setTimeout(() => resolve(false), waitMs);
		req.onsuccess = () => {
			clearTimeout(timer);
			resolve(true);
		};
		req.onerror = () => {
			clearTimeout(timer);
			resolve(false);
		};
	});
}
