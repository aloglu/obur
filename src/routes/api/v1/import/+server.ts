import { error, json } from '@sveltejs/kit';
import { archiveKind, ArchiveError } from '#lib/server/modules/imports-exports/index.ts';
import { portability, readArchiveBody, respondPortability } from '#lib/server/portability.ts';
import { isValidZone } from '#lib/shared/diary-rules.ts';
import type { RequestHandler } from './$types';

// The archive is the request body: an obur export or a LoseIt export, told apart by its files. ?apply=1 imports;
// otherwise this is the dry run. A LoseIt import also takes zone, weightUnit (kg|lb), share=1 and trashMissing=1.
export const POST: RequestHandler = ({ request, url, locals }) =>
	respondPortability(async () => {
		const bytes = await readArchiveBody(request);
		const userId = locals.session!.userId;
		const apply = url.searchParams.get('apply') === '1';
		const kind = archiveKind(bytes);
		if (kind === 'loseit') {
			const zone = url.searchParams.get('zone') ?? '';
			const weightUnit = url.searchParams.get('weightUnit') ?? 'kg';
			if (!isValidZone(zone) || (weightUnit !== 'kg' && weightUnit !== 'lb'))
				error(400, 'Invalid options');
			const options = {
				zone,
				weightUnit: weightUnit as 'kg' | 'lb',
				shareFoods: url.searchParams.get('share') === '1',
				trashMissing: url.searchParams.get('trashMissing') === '1'
			};
			const summary = apply
				? await portability.applyLoseIt(userId, bytes, options)
				: await portability.previewLoseIt(userId, bytes, options);
			return json({ summary });
		}
		if (kind === 'unknown') throw new ArchiveError('not_an_archive');
		const summary = apply
			? await portability.applyImport(userId, bytes)
			: await portability.previewImport(userId, bytes);
		return json({ summary });
	});
