// Archive work off the web app's main thread (2026-11-20 audit, R06; owner's choice: in the web app, one at a time).
// Reading a five-year archive took 0.9 s and one near the limit 4.8 s of the main thread, during which obur answered
// nobody else. Each task now runs in its own worker thread, and only one runs at a time on the whole server, so a
// second import waits for the first instead of doubling the memory. Database work stays on the main thread, in one
// transaction as before.
import path from 'node:path';
import { Worker } from 'node:worker_threads';
import { ArchiveError, type Manifest, type PortableData } from './archive.ts';
import { LoseItError, type LoseItData } from './loseit.ts';

export type ArchiveTask =
	| { kind: 'read' | 'loseit'; bytes: Uint8Array }
	| { kind: 'write'; data: PortableData; meta: { exportedAt: string; sourceInstallation: string } };

type Answer =
	| { ok: true; result: unknown }
	| {
			ok: false;
			kind: 'archive' | 'loseit' | 'other';
			code?: string;
			detail?: string;
			message: string;
	  };

// The worker runs from the source tree, which the image keeps (Dockerfile) and every other start runs from.
const WORKER = path.join(process.cwd(), 'src/lib/server/modules/imports-exports/archive-worker.ts');

let queue: Promise<unknown> = Promise.resolve();

function run<T>(task: ArchiveTask): Promise<T> {
	const next = queue.then(
		() =>
			new Promise<T>((resolve, reject) => {
				const worker = new Worker(WORKER, { workerData: task });
				let answered = false;
				worker.once('message', (answer: Answer) => {
					answered = true;
					void worker.terminate();
					if (answer.ok) return resolve(answer.result as T);
					if (answer.kind === 'archive')
						return reject(new ArchiveError(answer.code as ArchiveError['code'], answer.detail));
					if (answer.kind === 'loseit')
						return reject(new LoseItError(answer.code as LoseItError['code'], answer.detail));
					reject(new Error(answer.message));
				});
				worker.once('error', (e) => {
					if (!answered) reject(e);
				});
				worker.once('exit', (code) => {
					if (!answered) reject(new Error(`archive worker stopped (${code})`));
				});
			})
	);
	// The next task waits for this one, whatever its result.
	queue = next.catch(() => {});
	return next;
}

export const archiveThread = {
	read: (bytes: Uint8Array) =>
		run<{ manifest: Manifest; data: PortableData }>({ kind: 'read', bytes }),
	loseit: (bytes: Uint8Array) => run<LoseItData>({ kind: 'loseit', bytes }),
	write: (data: PortableData, meta: { exportedAt: string; sourceInstallation: string }) =>
		run<Uint8Array>({ kind: 'write', data, meta })
};
