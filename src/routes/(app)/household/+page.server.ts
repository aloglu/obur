import { redirect } from '@sveltejs/kit';
import { catalog } from '#lib/server/catalog.ts';
import { remoteModels } from '#lib/server/remote-models.ts';
import { updates } from '#lib/server/updates.ts';
import { auth } from '#lib/server/auth.ts';
import { asJson } from '#lib/server/as-json.ts';
import { backupReport } from '#lib/server/backup-status.ts';
import { portability } from '#lib/server/portability.ts';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals }) => {
	if (locals.session?.role !== 'admin') redirect(303, '/');
	// Household totals of how much label scans were edited before saving (counts only).
	const session = locals.session;
	const [scanTotals, personalKeys, updateStatus, invites, members, deletions, backups] =
		await Promise.all([
			catalog.labelScanTotals(session.userId),
			remoteModels.householdAllows(session.userId),
			updates.status(session.userId, true),
			// The lists arrive with the page (and so are prepared with it), never fetched after it opens.
			auth.listInvites(session),
			portability.members(session.userId),
			portability.deletions(session.userId),
			backupReport()
		]);
	return {
		scanTotals,
		personalKeys,
		updates: updateStatus,
		...asJson({ invites, members, deletions, backups })
	};
};
