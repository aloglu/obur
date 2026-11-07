// Backup health for the admin page, from the status file the backup tool writes (deploy/obur/obur-backup).
// Problems are stated plainly: no recent backup, a failed backup or restore check, WAL archiving failing, or no
// off-site copy (docs/design.md, "Data safety, backups and restore").
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { OBUR_STATUS_DIR } from '$app/env/private';
import { assessBackups, type BackupReport } from '#lib/shared/backup-health.ts';

export async function backupReport(now = new Date()): Promise<BackupReport> {
	if (!OBUR_STATUS_DIR) return assessBackups(null, now, false);
	try {
		const raw = JSON.parse(await readFile(path.join(OBUR_STATUS_DIR, 'backup.json'), 'utf8'));
		return assessBackups(raw, now, true);
	} catch {
		return assessBackups(null, now, true);
	}
}
