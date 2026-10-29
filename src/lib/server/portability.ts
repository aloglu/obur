// The application's export/import/deletion service instance (runtime role) and its HTTP error mapping.
import { json } from '@sveltejs/kit';
import {
	ARCHIVE_LIMITS,
	ArchiveError,
	createPortability,
	PortabilityError
} from '#lib/server/modules/imports-exports/index.ts';
import { db } from './db/index.ts';
import { respond } from './http.ts';

export const portability = createPortability(db);

const STATUS = { already_imported: 409, last_admin: 409, not_found: 404, forbidden: 403 } as const;

/** Like respond(), and also maps archive and portability errors to `{ error, detail? }`. */
export function respondPortability(run: () => Promise<Response>): Promise<Response> {
	return respond(async () => {
		try {
			return await run();
		} catch (e) {
			if (e instanceof ArchiveError)
				return json({ error: `archive_${e.code}`, detail: e.detail }, { status: 422 });
			if (e instanceof PortabilityError) return json({ error: e.code }, { status: STATUS[e.code] });
			throw e;
		}
	});
}

/** Reads an uploaded archive, refusing anything over the archive limit before and while reading it. */
export async function readArchiveBody(request: Request): Promise<Uint8Array> {
	const declared = Number(request.headers.get('content-length') ?? 0);
	if (declared > ARCHIVE_LIMITS.archiveBytes) throw new ArchiveError('too_large');
	const bytes = new Uint8Array(await request.arrayBuffer());
	if (bytes.length > ARCHIVE_LIMITS.archiveBytes) throw new ArchiveError('too_large');
	return bytes;
}
