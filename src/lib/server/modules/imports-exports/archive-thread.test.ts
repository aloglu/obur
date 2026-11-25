import { setFlagsFromString } from 'node:v8';
import { runInNewContext } from 'node:vm';
import { expect, it } from 'vitest';
import type { PortableData } from './archive.ts';
import { archiveThread } from './archive-thread.ts';

// The garbage collector, callable from a test (a known Node way; no command-line flag needed).
setFlagsFromString('--expose-gc');
const gc = runInNewContext('gc') as () => void;

const empty = {
	account: {},
	foods: [],
	diary: [],
	dayCompletions: [],
	weight: [],
	water: [],
	activity: [],
	targets: [],
	savedMeals: [],
	recipes: [],
	dayNotes: [],
	loseitIdentities: []
} as unknown as PortableData;
const meta = {
	exportedAt: '2026-11-25T00:00:00.000Z',
	sourceInstallation: '00000000-0000-4000-8000-000000000000'
};

it('keeps no finished archive in memory (2026-11-25 audit: the queue held the last one)', async () => {
	// Only a weak reference leaves this function: nothing in the test keeps the archive.
	const exported = async () => {
		const archive = await archiveThread.write(empty, meta);
		expect(archive.byteLength).toBeGreaterThan(0);
		return new WeakRef(archive);
	};
	const ref = await exported();
	// Lets the queue's own promises settle, then collects.
	await new Promise((resolve) => setTimeout(resolve, 10));
	gc();
	expect(ref.deref()).toBeUndefined();
});
