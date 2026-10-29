// The application's diary instance and its HTTP error mapping.
import { json } from '@sveltejs/kit';
import { createDiary, DiaryError } from '#lib/server/modules/diary/index.ts';
import { db } from './db/index.ts';

export const diary = createDiary(db);

const STATUS = { not_found: 404, conflict: 409, conversion_unknown: 422, gone: 410 } as const;

export async function respondDiary(run: () => Promise<Response>): Promise<Response> {
	try {
		return await run();
	} catch (e) {
		if (e instanceof DiaryError) return json({ error: e.code }, { status: STATUS[e.code] });
		throw e;
	}
}
