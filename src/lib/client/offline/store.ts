// The offline queue's storage: one IndexedDB database per account, so one person's unsent entries can never be
// sent as another's (docs/design.md, "Offline scope and synchronization"). Items keep creation order.

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

export async function openQueue(ownerId: string) {
	const db = await new Promise<IDBDatabase>((resolve, reject) => {
		const req = indexedDB.open(dbName(ownerId), 1);
		req.onupgradeneeded = () =>
			req.result.createObjectStore('ops', { keyPath: 'seq', autoIncrement: true });
		req.onsuccess = () => resolve(req.result);
		req.onerror = () => reject(req.error);
	});
	const store = (mode: IDBTransactionMode) => db.transaction('ops', mode).objectStore('ops');
	return {
		add: (op: QueuedOp) => request(store('readwrite').add(op)) as Promise<number>,
		put: (op: QueuedOp) => request(store('readwrite').put(op)),
		remove: (seq: number) => request(store('readwrite').delete(seq)),
		/** All items in creation order. */
		all: async () =>
			((await request(store('readonly').getAll())) as QueuedOp[]).sort((a, b) => a.seq! - b.seq!),
		close: () => db.close()
	};
}

export type Queue = Awaited<ReturnType<typeof openQueue>>;

/** Removes an account's queue from this device (sign-out with nothing pending, or after discarding). */
export function deleteQueue(ownerId: string): Promise<void> {
	return new Promise((resolve) => {
		const req = indexedDB.deleteDatabase(dbName(ownerId));
		req.onsuccess = req.onerror = req.onblocked = () => resolve();
	});
}
