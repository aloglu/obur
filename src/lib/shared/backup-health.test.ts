import { describe, expect, it } from 'vitest';
import { assessBackups, type BackupStatusFile } from './backup-health.ts';

const now = new Date('2026-10-29T12:00:00Z');
const healthy: BackupStatusFile = {
	offsiteConfigured: true,
	lastBackup: {
		at: '2026-10-29T00:00:00Z',
		type: 'diff',
		ok: true,
		repos: { '1': true, '2': true }
	},
	lastSuccessfulBackupAt: '2026-10-29T00:00:00Z',
	archive: {
		lastArchivedAt: '2026-10-29T11:58:00Z',
		failedCount: 2,
		lastFailedAt: '2026-10-20T00:00:00Z'
	},
	lastRestoreCheck: { at: '2026-10-25T01:00:00Z', ok: true, detail: 'fine' },
	lastOffsiteRestoreCheck: { at: '2026-10-25T01:05:00Z', ok: true, detail: 'fine' }
};

describe('assessBackups', () => {
	it('reports nothing when backups, archiving, off-site and the restore check are fine', () => {
		expect(assessBackups(healthy, now, true).problems).toEqual([]);
	});

	it('warns plainly when there is no off-site copy', () => {
		expect(assessBackups({ ...healthy, offsiteConfigured: false }, now, true).problems).toEqual([
			'no_offsite'
		]);
	});

	it('flags missed, failed and partly failed backups', () => {
		const stale = { ...healthy, lastSuccessfulBackupAt: '2026-10-27T12:00:00Z' };
		expect(assessBackups(stale, now, true).problems).toContain('backup_stale');
		const offsite = {
			...healthy,
			lastBackup: { ...healthy.lastBackup!, ok: false, repos: { '1': true, '2': false } }
		};
		expect(assessBackups(offsite, now, true).problems).toEqual(['offsite_failed']);
		const none = { ...healthy, lastSuccessfulBackupAt: undefined, lastBackup: undefined };
		expect(assessBackups(none, now, true).problems).toContain('no_backup');
	});

	it('flags archiving that is failing now, not a failure that has since recovered', () => {
		const failing = {
			...healthy,
			archive: { ...healthy.archive!, lastFailedAt: '2026-10-29T11:59:00Z' }
		};
		expect(assessBackups(failing, now, true).problems).toEqual(['archive_failing']);
	});

	it('flags a failed or overdue restore check', () => {
		const failed = { ...healthy, lastRestoreCheck: { ...healthy.lastRestoreCheck!, ok: false } };
		expect(assessBackups(failed, now, true).problems).toEqual(['restore_check_failed']);
		const overdue = { ...healthy, lastRestoreCheck: undefined };
		expect(assessBackups(overdue, now, true).problems).toEqual(['restore_check_stale']);
	});

	it('flags an off-site copy that has never been restored, or failed to restore', () => {
		const never = { ...healthy, lastOffsiteRestoreCheck: undefined };
		expect(assessBackups(never, now, true).problems).toEqual(['offsite_restore_stale']);
		const failed = {
			...healthy,
			lastOffsiteRestoreCheck: { ...healthy.lastOffsiteRestoreCheck!, ok: false }
		};
		expect(assessBackups(failed, now, true).problems).toEqual(['offsite_restore_failed']);
		// Without an off-site copy, only the plain warning about that.
		const local = { ...never, offsiteConfigured: false };
		expect(assessBackups(local, now, true).problems).toEqual(['no_offsite']);
	});

	it('distinguishes an installation without backups from a missing status file', () => {
		expect(assessBackups(null, now, false).problems).toEqual(['not_configured']);
		expect(assessBackups(null, now, true).problems).toEqual(['no_status']);
	});

	it('says when the off-site copy is behind or has lost changes, without touching the local verdict', () => {
		const waiting = (oldestAt: string, gapAt: string | null = null) =>
			assessBackups({ ...healthy, offsiteQueue: { waiting: 4, oldestAt, gapAt } }, now, true)
				.problems;
		// A short outage is not a warning.
		expect(waiting('2026-10-29T11:30:00Z')).toEqual([]);
		expect(waiting('2026-10-29T09:00:00Z')).toEqual(['offsite_behind']);
		expect(waiting('2026-10-29T09:00:00Z', '2026-10-29T10:00:00Z')).toEqual(['offsite_gap']);
		const drained = { waiting: 0, oldestAt: null, gapAt: null };
		expect(assessBackups({ ...healthy, offsiteQueue: drained }, now, true).problems).toEqual([]);
	});
});
