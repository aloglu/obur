<script lang="ts">
	// docs/ui.md "Server": what an admin looks after for the whole installation (backups, updates, personal AI keys,
	// label scan totals). People and invites are on Members.
	import Check from '@lucide/svelte/icons/check';
	import { resolve } from '$app/paths';
	import { invalidateAll } from '$app/navigation';
	import { untrack } from 'svelte';
	import { m } from '#lib/paraglide/messages.js';
	import { api, ApiError } from '#lib/client/api.ts';
	import { describeError, withRecentAuth } from '#lib/client/passkeys.ts';
	import { clockTime } from '#lib/client/prefs.ts';
	import { showToast } from '#lib/client/toast.svelte.ts';
	import { shortDate } from '#lib/shared/format.ts';
	import type { BackupProblem, BackupReport } from '#lib/shared/backup-health.ts';
	import type { UpdateStatus } from '#lib/server/modules/updates/index.ts';
	import PageHead from '#lib/ui/PageHead.svelte';
	import Notice from '#lib/ui/Notice.svelte';
	import Switch from '#lib/ui/Switch.svelte';

	interface Deletion {
		accountId: string;
		deletedAt: string;
		by: 'self' | 'admin';
	}

	let { data } = $props();
	let personalKeys = $state(untrack(() => data.personalKeys));
	// The check for new versions: off until an admin turns it on (it asks GitHub). Turning it on asks at once.
	let updates = $state(untrack(() => data.updates));
	let updateCheck = $state(untrack(() => data.updates.check));
	let checking = $state(false);
	async function saveUpdateCheck(on: boolean) {
		checking = true;
		try {
			// An admin setting: the server asks for a passkey moments old (as for the other admin settings).
			({ updates } = await withRecentAuth(() =>
				api<{ updates: UpdateStatus }>('PUT', '/api/v1/admin/update-check', { on })
			));
		} catch {
			updateCheck = !on;
			showToast({ message: m.settings_save_failed() });
		} finally {
			checking = false;
		}
	}
	async function savePersonalKeys(allow: boolean) {
		try {
			// An admin setting: the server asks for a passkey moments old (as for invites and deletions).
			await withRecentAuth(() => api('PUT', '/api/v1/admin/personal-keys', { allow }));
			await invalidateAll();
		} catch (e) {
			personalKeys = !allow;
			showToast({
				message:
					e instanceof ApiError || e instanceof DOMException
						? describeError(e)
						: m.settings_save_failed()
			});
		}
	}
	const deletions = $derived(data.deletions as Deletion[]);
	const backups = $derived(data.backups as BackupReport | null);

	const date = (iso: string) => shortDate(iso.slice(0, 10));

	const problemText: Record<BackupProblem, () => string> = {
		not_configured: m.backup_not_configured,
		no_status: m.backup_no_status,
		no_backup: m.backup_no_backup,
		backup_stale: m.backup_backup_stale,
		backup_failed: m.backup_backup_failed,
		offsite_failed: m.backup_offsite_failed,
		offsite_behind: m.backup_offsite_behind,
		offsite_gap: m.backup_offsite_gap,
		archive_failing: m.backup_archive_failing,
		archive_behind: m.backup_archive_behind,
		scheduler_stopped: m.backup_scheduler_stopped,
		restore_check_failed: m.backup_restore_check_failed,
		restore_check_stale: m.backup_restore_check_stale,
		offsite_restore_failed: m.backup_offsite_restore_failed,
		offsite_restore_stale: m.backup_offsite_restore_stale,
		no_offsite: m.backup_no_offsite
	};
	const when = (iso: string | null) =>
		iso
			? `${date(iso)}, ${clockTime(iso, data.timeFormat ?? 'device')}`
			: m.members_backups_never();

	async function copyText(text: string, message: string, detail: string) {
		try {
			await navigator.clipboard.writeText(text);
			showToast({ message, detail });
		} catch {
			showToast({ message: m.members_copy_failed(), detail: m.members_copy_failed_detail() });
		}
	}
	// The entries as `obur restore finish` takes them: <ID>@<deletion date>.
	const copyDeletions = () =>
		copyText(
			deletions.map((d) => `${d.accountId}@${d.deletedAt.slice(0, 10)}`).join(' '),
			m.members_deletions_copied(),
			m.members_deletions_copied_detail()
		);
</script>

<svelte:head><title>{m.server_title()} · {m.app_name()}</title></svelte:head>

{#snippet label(text: string, id: string)}
	<h2 {id} class="mb-1.5 px-1 text-[0.8125rem] font-[650] text-muted">{text}</h2>
{/snippet}
{#snippet facts(rows: [string, string][], testid?: string)}
	<dl class="flex flex-col divide-y divide-line text-[0.875rem]" data-testid={testid}>
		{#each rows as [name, value] (name)}
			<div class="flex justify-between gap-3 py-2.5 text-muted">
				<dt>{name}</dt>
				<dd class="m-0 font-[650] text-text tabular-nums">{value}</dd>
			</div>
		{/each}
	</dl>
{/snippet}

<main class="mx-auto flex max-w-[640px] flex-col gap-4 px-3.5 py-4 desk:px-7">
	<div class="flex flex-col gap-3">
		<PageHead href={resolve('/(app)/more')} label={m.nav_more()} title={m.server_title()} />
	</div>
	{#if backups}
		<section aria-labelledby="backups-label">
			{@render label(m.members_backups(), 'backups-label')}
			<div class="flex flex-col gap-2.5 rounded-card bg-surface p-[18px] shadow-card">
				{#each backups.problems as p (p)}
					<Notice tone={p === 'not_configured' || p === 'no_status' ? 'info' : 'warn'}>
						{problemText[p]()}
					</Notice>
				{/each}
				{#if backups.problems.length === 0}
					<p class="flex items-center gap-3 text-[1.0625rem] font-[650]">
						<span
							class="grid size-10 shrink-0 place-items-center rounded-small text-good"
							style:background="color-mix(in srgb, var(--good) 13%, var(--surface))"
							><Check size={22} aria-hidden="true" /></span
						>
						{m.members_backups_ok()}
					</p>
				{/if}
				{@render facts([
					[m.members_backups_last(), when(backups.lastSuccessfulBackupAt)],
					[m.members_backups_check(), when(backups.lastRestoreCheckAt)],
					backups.offsiteConfigured
						? [m.members_backups_offsite_check(), when(backups.lastOffsiteRestoreCheckAt)]
						: [m.members_backups_offsite(), m.members_backups_offsite_none()]
				])}
				<div class="flex flex-col gap-1.5 border-t border-line pt-3" data-testid="deleted-accounts">
					<div class="flex items-center justify-between gap-3">
						<h3 class="text-[0.9375rem] font-semibold">{m.members_deletions()}</h3>
						{#if deletions.length > 0}
							<button
								type="button"
								onclick={copyDeletions}
								class="min-h-11 shrink-0 text-[0.875rem] font-bold text-accent"
								>{m.members_deletions_copy()}</button
							>
						{/if}
					</div>
					<p class="text-[0.8125rem] leading-snug text-muted">{m.members_deletions_body()}</p>
					{#if deletions.length === 0}
						<p class="py-1 text-[0.875rem] text-muted">{m.members_deletions_none()}</p>
					{:else}
						<ul class="flex flex-col divide-y divide-line" data-testid="deletions">
							{#each deletions as d (d.accountId)}
								<li class="flex flex-col py-2">
									<span class="font-mono text-[0.8125rem] break-all">{d.accountId}</span>
									<span class="text-[0.8125rem] text-muted"
										>{[
											date(d.deletedAt),
											d.by === 'self'
												? m.members_deletions_by_self()
												: m.members_deletions_by_admin()
										].join(' · ')}</span
									>
								</li>
							{/each}
						</ul>
					{/if}
				</div>
			</div>
		</section>
	{/if}

	<section aria-labelledby="updates-label">
		{@render label(m.members_updates(), 'updates-label')}
		<div class="flex flex-col gap-3 rounded-card bg-surface p-[18px] shadow-card">
			{#if updates.latest}
				<Notice tone="info" title={m.members_updates_newer({ version: updates.latest })}>
					<a
						href="https://github.com/aloglu/obur/blob/main/docs/install/updating.md"
						target="_blank"
						rel="noreferrer"
						class="font-semibold text-accent underline">{m.members_updates_how()}</a
					>
				</Notice>
			{/if}
			<Switch
				label={m.members_updates_check()}
				detail={m.members_updates_check_line()}
				bind:checked={updateCheck}
				onchange={saveUpdateCheck}
			/>
			{@render facts(
				[
					[m.members_updates_current(), updates.current],
					...(updates.check && !checking
						? [
								[
									m.members_updates_checked(),
									updates.checkedAt
										? updates.latest
											? when(updates.checkedAt)
											: m.members_updates_none({ when: when(updates.checkedAt) })
										: m.members_updates_unreachable()
								] as [string, string]
							]
						: [])
				],
				'update-facts'
			)}
		</div>
	</section>

	<section aria-labelledby="keys-label">
		{@render label(m.members_personal_keys(), 'keys-label')}
		<div class="flex flex-col gap-3 rounded-card bg-surface p-[18px] shadow-card">
			<Switch
				label={m.members_personal_keys()}
				detail={m.members_personal_keys_line()}
				bind:checked={personalKeys}
				onchange={savePersonalKeys}
			/>
			{#if !personalKeys}
				<p class="text-[0.8125rem] leading-snug text-muted">{m.members_personal_keys_off()}</p>
			{/if}
		</div>
	</section>

	<section aria-labelledby="scans-label">
		{@render label(m.members_scans(), 'scans-label')}
		<div class="flex flex-col gap-2 rounded-card bg-surface p-[18px] shadow-card">
			<p class="text-[0.8125rem] text-muted">{m.members_scans_body()}</p>
			{#if data.scanTotals.scans === 0}
				<p class="text-[0.875rem] text-muted">{m.members_scans_none()}</p>
			{:else}
				{@const t = data.scanTotals}
				{@const share = (part: number, whole: number) =>
					whole ? ` (${Math.round((part / whole) * 100)} %)` : ''}
				{@render facts(
					[
						[m.members_scans_saved(), `${t.scans}`],
						[m.members_scans_without_edits(), `${t.withoutEdits}${share(t.withoutEdits, t.scans)}`],
						[m.members_scans_values(), `${t.proposed}`],
						[m.members_scans_changed(), `${t.changed}${share(t.changed, t.proposed)}`],
						[m.members_scans_removed(), `${t.removed}${share(t.removed, t.proposed)}`],
						[m.members_scans_added(), `${t.added}`],
						[m.members_scans_basis_unknown(), `${t.basisUnknown}`],
						[m.members_scans_basis_changed(), `${t.basisChanged}`]
					],
					'scan-totals'
				)}
			{/if}
		</div>
	</section>
</main>
