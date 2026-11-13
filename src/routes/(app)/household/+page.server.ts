import { redirect } from '@sveltejs/kit';
import { catalog } from '#lib/server/catalog.ts';
import { remoteModels } from '#lib/server/remote-models.ts';
import { updates } from '#lib/server/updates.ts';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals }) => {
	if (locals.session?.role !== 'admin') redirect(303, '/');
	// Household totals of how much label scans were edited before saving (counts only).
	const [scanTotals, personalKeys, updateStatus] = await Promise.all([
		catalog.labelScanTotals(locals.session.userId),
		remoteModels.householdAllows(locals.session.userId),
		updates.status(locals.session.userId, true)
	]);
	return { scanTotals, personalKeys, updates: updateStatus };
};
