import { redirect } from '@sveltejs/kit';
import { catalog } from '#lib/server/catalog.ts';
import { remoteModels } from '#lib/server/remote-models.ts';
import { updates } from '#lib/server/updates.ts';
import { asJson } from '#lib/server/as-json.ts';
import { backupReport } from '#lib/server/backup-status.ts';
import { portability } from '#lib/server/portability.ts';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals }) => {
	if (locals.session?.role !== 'admin') redirect(303, '/');
	const session = locals.session;
	const [scanTotals, personalKeys, updateStatus, deletions, backups] = await Promise.all([
		// Totals across members of how much label scans were edited before saving (counts only).
		catalog.labelScanTotals(session.userId),
		remoteModels.personalKeysAllowed(session.userId),
		// The stored answer: the page asks GitHub afterwards, so it never waits for it (Gemini audit 2, H11).
		updates.stored(session.userId, true),
		// The deleted accounts a restore needs (docs/restore.md).
		portability.deletions(session.userId),
		backupReport()
	]);
	return {
		scanTotals,
		personalKeys,
		updates: updateStatus,
		...asJson({ deletions, backups })
	};
};
