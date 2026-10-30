// Rules for judging backup health from the database container's status file. Pure, so they can be tested.

export interface BackupStatusFile {
	offsiteConfigured?: boolean;
	lastBackup?: { at: string; type: string; ok: boolean; repos: Record<string, boolean> };
	lastSuccessfulBackupAt?: string;
	archive?: { lastArchivedAt: string | null; failedCount: number; lastFailedAt: string | null };
	lastRestoreCheck?: { at: string; ok: boolean; detail: string };
	/** The same check restoring from the off-site copy (when one is configured). */
	lastOffsiteRestoreCheck?: { at: string; ok: boolean; detail: string };
}

export type BackupProblem =
	| 'not_configured'
	| 'no_status'
	| 'no_backup'
	| 'backup_stale'
	| 'backup_failed'
	| 'offsite_failed'
	| 'archive_failing'
	| 'restore_check_failed'
	| 'restore_check_stale'
	| 'offsite_restore_failed'
	| 'offsite_restore_stale'
	| 'no_offsite';

export interface BackupReport {
	problems: BackupProblem[];
	lastSuccessfulBackupAt: string | null;
	lastRestoreCheckAt: string | null;
	offsiteConfigured: boolean;
}

const HOUR = 3600_000;
/** A nightly backup that is over a day and a half old has been missed. */
export const BACKUP_MAX_AGE_MS = 36 * HOUR;
/** The weekly restore check, with a day of slack. */
export const RESTORE_CHECK_MAX_AGE_MS = 8 * 24 * HOUR;

export function assessBackups(
	status: BackupStatusFile | null,
	now: Date,
	deployed: boolean
): BackupReport {
	const problems: BackupProblem[] = [];
	const age = (iso: string | null | undefined) =>
		iso ? now.getTime() - new Date(iso).getTime() : Infinity;
	if (!deployed) problems.push('not_configured');
	else if (!status) problems.push('no_status');
	else {
		if (!status.lastSuccessfulBackupAt) problems.push('no_backup');
		else if (age(status.lastSuccessfulBackupAt) > BACKUP_MAX_AGE_MS) problems.push('backup_stale');
		if (status.lastBackup && !status.lastBackup.repos['1']) problems.push('backup_failed');
		if (status.offsiteConfigured && status.lastBackup && status.lastBackup.repos['2'] === false)
			problems.push('offsite_failed');
		const archive = status.archive;
		// Failing now: the latest failure is newer than the latest success.
		if (archive?.lastFailedAt && age(archive.lastFailedAt) < age(archive.lastArchivedAt))
			problems.push('archive_failing');
		if (status.lastRestoreCheck && !status.lastRestoreCheck.ok)
			problems.push('restore_check_failed');
		else if (age(status.lastRestoreCheck?.at) > RESTORE_CHECK_MAX_AGE_MS)
			problems.push('restore_check_stale');
		if (!status.offsiteConfigured) problems.push('no_offsite');
		else if (status.lastOffsiteRestoreCheck && !status.lastOffsiteRestoreCheck.ok)
			problems.push('offsite_restore_failed');
		else if (age(status.lastOffsiteRestoreCheck?.at) > RESTORE_CHECK_MAX_AGE_MS)
			problems.push('offsite_restore_stale');
	}
	return {
		problems,
		lastSuccessfulBackupAt: status?.lastSuccessfulBackupAt ?? null,
		lastRestoreCheckAt: status?.lastRestoreCheck?.at ?? null,
		offsiteConfigured: !!status?.offsiteConfigured
	};
}
