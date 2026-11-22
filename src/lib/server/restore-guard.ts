// While a restore from backup is pending (docs/restore.md), the app stays closed: the database may still hold
// sessions and accounts that must be revoked or deleted again before anyone signs in. `obur restore` keeps the
// restore's state in restore.json (deploy/obur/env.sh) and removes it when the restore is finished; restore-pending is
// the mark of versions before 1.0.0-rc.9, still honoured until the container converts it. If the folder cannot be
// read, the app stays closed too.
import { existsSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { OBUR_STATUS_DIR } from '$app/env/private';

const CHECK_EVERY_MS = 5000;
let checkedAt = 0;
let pending = false;

export function restorePending(now = Date.now()): boolean {
	if (!OBUR_STATUS_DIR) return false;
	if (now - checkedAt > CHECK_EVERY_MS) {
		checkedAt = now;
		try {
			readdirSync(OBUR_STATUS_DIR);
			pending =
				existsSync(path.join(OBUR_STATUS_DIR, 'restore.json')) ||
				existsSync(path.join(OBUR_STATUS_DIR, 'restore-pending'));
		} catch (e) {
			// Fail closed: without being able to look, the app cannot know that no restore is pending.
			if (!pending)
				console.error(`restore guard: cannot read ${OBUR_STATUS_DIR}:`, (e as Error).message);
			pending = true;
		}
	}
	return pending;
}
