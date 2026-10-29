// The application's body instance and its HTTP error mapping.
import { json } from '@sveltejs/kit';
import { BodyError, createBody } from '#lib/server/modules/body/index.ts';
import { db } from './db/index.ts';

export const body = createBody(db);

export async function respondBody(run: () => Promise<Response>): Promise<Response> {
	try {
		return await run();
	} catch (e) {
		if (e instanceof BodyError) {
			const status = { not_found: 404, conflict: 409, gone: 410 }[e.code];
			return json({ error: e.code }, { status });
		}
		throw e;
	}
}
