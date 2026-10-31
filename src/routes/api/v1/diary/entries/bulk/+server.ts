import { json } from '@sveltejs/kit';
import { diary, respondDiary } from '#lib/server/diary.ts';
import { readJson } from '#lib/server/http.ts';
import { BulkEntries } from '#lib/shared/diary-input.ts';
import type { RequestHandler } from './$types';

/**
 * POST { action: place | copy | delete | restore, … }: several entries at once, all or none (shared/diary-input.ts).
 * Returns the affected entries as they are afterwards.
 */
export const POST: RequestHandler = ({ request, locals }) =>
	respondDiary(async () => {
		const body = await readJson(request, BulkEntries);
		return json({ entries: await diary.bulk(locals.session!.userId, body) });
	});
