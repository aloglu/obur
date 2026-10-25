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
			return json({ error: e.code }, { status: e.code === 'not_found' ? 404 : 409 });
		}
		throw e;
	}
}
