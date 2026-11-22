import { error, json } from '@sveltejs/kit';
import { archiveKind, ArchiveError } from '#lib/server/modules/imports-exports/index.ts';
import { portability, readArchiveBody, respondPortability } from '#lib/server/portability.ts';
import { isValidZone } from '#lib/shared/diary-rules.ts';
import type { RequestHandler } from './$types';

// The archive is the request body: an obur export or a LoseIt export, told apart by its files. Without ?apply=1 this
// is the dry run, whose summary carries `confirm`; ?apply=1&confirm=… imports only if the plan is still that one
// (otherwise 409 plan_changed with the new summary). A LoseIt import also takes zone, weightUnit (kg|lb), waterUnit (ml|floz),
// trashMissing=1 and keepCopies=1.
export const POST: RequestHandler = ({ request, url, locals }) =>
	respondPortability(async () => {
		const bytes = await readArchiveBody(request);
		const userId = locals.session!.userId;
		const apply = url.searchParams.get('apply') === '1';
		const confirm = url.searchParams.get('confirm') ?? '';
		if (apply && !/^[0-9a-f]{64}$/.test(confirm)) error(400, 'Preview first');
		const kind = archiveKind(bytes);
		if (kind === 'loseit') {
			const zone = url.searchParams.get('zone') ?? '';
			const weightUnit = url.searchParams.get('weightUnit') ?? 'kg';
			const waterUnit = url.searchParams.get('waterUnit') ?? 'ml';
			if (
				!isValidZone(zone) ||
				(weightUnit !== 'kg' && weightUnit !== 'lb') ||
				(waterUnit !== 'ml' && waterUnit !== 'floz')
			)
				error(400, 'Invalid options');
			const options = {
				zone,
				weightUnit: weightUnit as 'kg' | 'lb',
				waterUnit: waterUnit as 'ml' | 'floz',
				trashMissing: url.searchParams.get('trashMissing') === '1',
				keepCopies: url.searchParams.get('keepCopies') === '1'
			};
			const summary = apply
				? await portability.applyLoseIt(userId, bytes, options, confirm)
				: await portability.previewLoseIt(userId, bytes, options);
			return json({ summary });
		}
		if (kind === 'unknown') throw new ArchiveError('not_an_archive');
		const summary = apply
			? await portability.applyImport(userId, bytes, confirm)
			: await portability.previewImport(userId, bytes);
		return json({ summary });
	});
