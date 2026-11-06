// A note on this device of whose entries are waiting, so the sign-in page can say so while nobody is signed in and the
// queues can't be read by account (docs/ui.md, "Signing in and first day"). Only a name and a count, never the entries.
// Storage may be unavailable, and then the sign-in page just doesn't mention them.
const KEY = 'obur:waiting';

export interface Waiting {
	name: string;
	count: number;
}

function read(): Record<string, Waiting> {
	try {
		return JSON.parse(localStorage.getItem(KEY) ?? '{}');
	} catch {
		return {};
	}
}

function write(all: Record<string, Waiting>) {
	try {
		if (Object.keys(all).length) localStorage.setItem(KEY, JSON.stringify(all));
		else localStorage.removeItem(KEY);
	} catch {
		// Not noted on this device; the entries themselves are safe in the queue.
	}
}

export function noteWaiting(ownerId: string, name: string, count: number) {
	const all = read();
	if (count > 0) all[ownerId] = { name, count };
	else delete all[ownerId];
	write(all);
}

export const waitingAccounts = (): Waiting[] => Object.values(read());
