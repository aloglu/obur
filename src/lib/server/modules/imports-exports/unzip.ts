// Unpacks the files of a ZIP archive that `wanted` names, stopping as soon as their real unpacked size passes `max`
// (2026-11-22 Gemini audit, G07). fflate's unzipSync trusts each file's declared size: a file that declares one byte
// and unpacks to gigabytes was decompressed to the end (about 50 s of one CPU for a 20 MB upload, holding up every
// other import and export) before any size could be checked. Here the archive is fed in small pieces, each file's
// output is counted as it arrives, and nothing more is decompressed once the limit is passed.
import { Unzip, UnzipInflate, UnzipPassThrough, unzipSync, type UnzipFileInfo } from 'fflate';

/** Compressed input fed at a time: one piece unpacks to at most about 16 MB (deflate's ratio is about 1:1032). */
const PIECE = 16 * 1024;

export type Unpacked = Record<string, Uint8Array>;

/**
 * Files an upload may list. An obur export has at most 32 and a LoseIt export about 20; without a bound, a 20 MB
 * archive could list about 400,000 empty files, each visited on the main thread (2026-11-23 verification of G07).
 */
export const MAX_ENTRIES = 500;

export class TooManyEntries extends Error {
	constructor() {
		super('too_many_entries');
	}
}

/** Visits each file the archive lists, without unpacking any; throws TooManyEntries past MAX_ENTRIES. */
export function listZip(bytes: Uint8Array, visit: (file: UnzipFileInfo) => void): void {
	let count = 0;
	unzipSync(bytes, {
		filter: (file) => {
			if (++count > MAX_ENTRIES) throw new TooManyEntries();
			visit(file);
			return false;
		}
	});
}

/** The wanted files, or 'too_large'. Throws on a damaged archive. */
export function unzipLimited(
	bytes: Uint8Array,
	wanted: (name: string) => boolean,
	max: number
): Unpacked | 'too_large' {
	const parts = new Map<string, Uint8Array[]>();
	let total = 0;
	let count = 0;
	let over = false;
	let failure: unknown;
	const unzip = new Unzip((file) => {
		if (over) return;
		if (++count > MAX_ENTRIES) {
			over = true;
			return;
		}
		if (!wanted(file.name)) return;
		const chunks: Uint8Array[] = [];
		parts.set(file.name, chunks);
		file.ondata = (error, chunk) => {
			if (error) {
				failure ??= error;
				return;
			}
			if (over) return;
			total += chunk.length;
			if (total > max) {
				over = true;
				file.terminate();
				return;
			}
			chunks.push(chunk);
		};
		file.start();
	});
	unzip.register(UnzipInflate);
	unzip.register(UnzipPassThrough);
	for (let at = 0; at < bytes.length && !over && !failure; at += PIECE) {
		const end = Math.min(at + PIECE, bytes.length);
		unzip.push(bytes.subarray(at, end), end === bytes.length);
	}
	if (over) return 'too_large';
	if (failure) throw failure;
	const out: Unpacked = {};
	for (const [name, chunks] of parts) {
		const file = new Uint8Array(chunks.reduce((n, c) => n + c.length, 0));
		let at = 0;
		for (const c of chunks) {
			file.set(c, at);
			at += c.length;
		}
		out[name] = file;
	}
	return out;
}
