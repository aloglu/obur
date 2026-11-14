import { error, json } from '@sveltejs/kit';
import * as v from 'valibot';
import { auth } from '#lib/server/auth.ts';
import { backupReport } from '#lib/server/backup-status.ts';
import { readJson } from '#lib/server/http.ts';
import { portability, respondPortability } from '#lib/server/portability.ts';
import type { RequestHandler } from './$types';

// Admin only: every account, the list of deleted ones (opaque ID and date) and backup health.
export const GET: RequestHandler = async ({ locals }) => {
	const session = locals.session!;
	if (session.role !== 'admin') error(403, 'Admins only');
	return json({
		members: await portability.members(session.userId),
		deletions: await portability.deletions(session.userId),
		backups: await backupReport()
	});
};

// Deletes another person's account (recent passkey check).
export const DELETE: RequestHandler = ({ request, locals }) =>
	respondPortability(async () => {
		const session = locals.session!;
		auth.requireAdmin(session);
		// Sensitive: a fresh passkey check, enforced here and not only by the page (CLAUDE.md).
		auth.requireRecent(session);
		const body = await readJson(
			request,
			v.object({ id: v.pipe(v.string(), v.uuid()), removeSharedFoods: v.boolean() })
		);
		if (body.id === session.userId) error(400, 'Use account deletion for your own account');
		await portability.deleteAccount(session.userId, body.id, body.removeSharedFoods);
		return json({ deleted: true });
	});
