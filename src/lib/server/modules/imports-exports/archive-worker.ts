// Runs one archive task in a worker thread (archive-thread.ts): unpacking, parsing and checking an import, or
// compressing an export. Node runs this file as TypeScript directly, as it does the operator scripts.
import { parentPort, workerData } from 'node:worker_threads';
import { ArchiveError, readArchive, writeArchive } from './archive.ts';
import { LoseItError, readLoseItArchive } from './loseit.ts';
import type { ArchiveTask } from './archive-thread.ts';

const task = workerData as ArchiveTask;
try {
	const result =
		task.kind === 'write'
			? writeArchive(task.data, task.meta)
			: task.kind === 'read'
				? readArchive(task.bytes)
				: readLoseItArchive(task.bytes);
	parentPort!.postMessage(
		{ ok: true, result },
		result instanceof Uint8Array ? [result.buffer as ArrayBuffer] : []
	);
} catch (e) {
	const known = e instanceof ArchiveError || e instanceof LoseItError;
	parentPort!.postMessage({
		ok: false,
		kind: e instanceof ArchiveError ? 'archive' : e instanceof LoseItError ? 'loseit' : 'other',
		code: known ? e.code : undefined,
		detail: known ? e.detail : undefined,
		message: (e as Error).message
	});
}
