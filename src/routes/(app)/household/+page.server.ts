import { redirect } from '@sveltejs/kit';
import { catalog } from '#lib/server/catalog.ts';
import { remoteModels } from '#lib/server/remote-models.ts';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals }) => {
	if (locals.session?.role !== 'admin') redirect(303, '/');
	// Household totals of how much label scans were edited before saving (counts only).
	const [scanTotals, personalKeys] = await Promise.all([
		catalog.labelScanTotals(locals.session.userId),
		remoteModels.householdAllows(locals.session.userId)
	]);
	return { scanTotals, personalKeys };
};
