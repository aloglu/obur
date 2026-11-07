<script lang="ts">
	import Check from '@lucide/svelte/icons/check';
	import Link from '@lucide/svelte/icons/link';
	import Link2Off from '@lucide/svelte/icons/link-2-off';
	import UserCheck from '@lucide/svelte/icons/user-check';
	import { resolve } from '$app/paths';
	import { onMount } from 'svelte';
	import { m } from '#lib/paraglide/messages.js';
	import { api } from '#lib/client/api.ts';
	import { describeError, withRecentAuth } from '#lib/client/passkeys.ts';
	import { clockTime } from '#lib/client/prefs.ts';
	import { showToast } from '#lib/client/toast.svelte.ts';
	import { shortDate } from '#lib/shared/format.ts';
	import BackLink from '#lib/ui/BackLink.svelte';
	import Button from '#lib/ui/Button.svelte';
	import Chips from '#lib/ui/Chips.svelte';
	import Sheet from '#lib/ui/Sheet.svelte';
	import type { BackupProblem, BackupReport } from '#lib/shared/backup-health.ts';
	import Notice from '#lib/ui/Notice.svelte';
	import TextField from '#lib/ui/TextField.svelte';

	interface Invite {
		id: string;
		note: string | null;
		expiresAt: string;
		usedAt: string | null;
		revokedAt: string | null;
		usedByName: string | null;
	}

	interface Member {
		id: string;
		displayName: string;
		role: 'admin' | 'member';
		createdAt: string;
	}
	interface Deletion {
		accountId: string;
		deletedAt: string;
		removedSharedFoods: boolean;
	}

	let { data } = $props();
	let invites = $state<Invite[]>([]);
	let members = $state<Member[]>([]);
	let deletions = $state<Deletion[]>([]);
	let backups = $state<BackupReport | null>(null);
	let deleting = $state<Member | null>(null);
	let removeShared = $state<'keep' | 'remove'>('keep');
	let note = $state('');
	let link = $state('');
	let understood = $state(false);
	let busy = $state(false);
	let problem = $state('');

	const date = (iso: string) => shortDate(iso.slice(0, 10));

	function status(i: Invite): string {
		if (i.usedAt) return m.household_status_used({ name: i.usedByName ?? '' });
		if (i.revokedAt) return m.household_status_revoked();
		if (new Date(i.expiresAt) < new Date()) return m.household_status_expired();
		return m.household_status_pending({ date: date(i.expiresAt) });
	}

	const refresh = async () => {
		invites = (await api<{ invites: Invite[] }>('GET', '/api/v1/auth/invites')).invites;
		({ members, deletions, backups } = await api<{
			members: Member[];
			deletions: Deletion[];
			backups: BackupReport;
		}>('GET', '/api/v1/household/members'));
	};
	onMount(refresh);

	async function run(action: () => Promise<void>) {
		busy = true;
		problem = '';
		try {
			await withRecentAuth(action);
			await refresh();
		} catch (e) {
			problem = describeError(e);
		} finally {
			busy = false;
		}
	}

	const create = () =>
		run(async () => {
			link = (await api<{ link: string }>('POST', '/api/v1/auth/invites', { note: note || null }))
				.link;
			note = '';
		});

	const problemText: Record<BackupProblem, () => string> = {
		not_configured: m.backup_not_configured,
		no_status: m.backup_no_status,
		no_backup: m.backup_no_backup,
		backup_stale: m.backup_backup_stale,
		backup_failed: m.backup_backup_failed,
		offsite_failed: m.backup_offsite_failed,
		archive_failing: m.backup_archive_failing,
		restore_check_failed: m.backup_restore_check_failed,
		restore_check_stale: m.backup_restore_check_stale,
		offsite_restore_failed: m.backup_offsite_restore_failed,
		offsite_restore_stale: m.backup_offsite_restore_stale,
		no_offsite: m.backup_no_offsite
	};
	const live = (i: Invite) => !i.usedAt && !i.revokedAt && new Date(i.expiresAt) > new Date();
	const when = (iso: string | null) =>
		iso
			? `${date(iso)}, ${clockTime(iso, data.timeFormat ?? 'device')}`
			: m.household_backups_never();

	const deleteMember = (member: Member) =>
		run(async () => {
			await api('DELETE', '/api/v1/household/members', {
				id: member.id,
				removeSharedFoods: removeShared === 'remove'
			});
			deleting = null;
		});

	const revoke = (i: Invite) => run(() => api('POST', '/api/v1/auth/invites/revoke', { id: i.id }));

	async function copy() {
		try {
			await navigator.clipboard.writeText(link);
			showToast({ message: m.household_copied(), detail: m.household_copied_detail() });
		} catch {
			showToast({ message: m.household_copy_failed(), detail: m.household_copy_failed_detail() });
		}
	}
</script>

<svelte:head><title>{m.household_title()} · {m.app_name()}</title></svelte:head>

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
		<BackLink href={resolve('/(app)/more')} label={m.nav_more()} />
		<h1 class="text-[1.5rem] font-[750]">{m.household_title()}</h1>
	</div>
	{#if problem && !deleting}<Notice>{problem}</Notice>{/if}

	<section aria-labelledby="people-label">
		{@render label(m.household_members(), 'people-label')}
		<ul class="flex flex-col divide-y divide-line rounded-card bg-surface px-[18px] shadow-card">
			{#each members as member (member.id)}
				<li
					class="grid min-h-16 grid-cols-[40px_minmax(0,1fr)_auto] items-center gap-3 py-2 large:grid-cols-[40px_minmax(0,1fr)]"
				>
					<span
						aria-hidden="true"
						class="grid size-10 place-items-center rounded-small bg-soft font-display text-[1.0625rem] font-extrabold text-accent"
						>{member.displayName.trim().slice(0, 1).toLocaleUpperCase('tr')}</span
					>
					<span class="min-w-0">
						<span class="flex flex-wrap items-center gap-1.5">
							<b class="text-[0.9375rem] font-semibold break-words">{member.displayName}</b>
							{#if member.id === data.user?.id}<span
									class="rounded-menu bg-surface2 px-2 py-0.5 text-[0.75rem] font-[650] text-muted"
									>{m.household_you()}</span
								>{/if}
							{#if member.role === 'admin'}<span
									class="rounded-menu bg-soft px-2 py-0.5 text-[0.75rem] font-[650] text-accent"
									>{m.household_admin()}</span
								>{/if}
						</span>
						<small class="block text-[0.8125rem] text-muted"
							>{m.household_joined({ date: date(member.createdAt) })}</small
						>
					</span>
					{#if member.id !== data.user?.id}
						<button
							type="button"
							disabled={busy}
							onclick={() => ((deleting = member), (removeShared = 'keep'), (understood = false))}
							class="min-h-11 text-[0.875rem] font-bold whitespace-nowrap text-bad large:col-start-2 large:justify-self-start"
							>{m.household_delete_member()}</button
						>
					{/if}
				</li>
			{/each}
		</ul>
	</section>

	<section class="flex flex-col" aria-labelledby="invite-label">
		{@render label(m.household_invite(), 'invite-label')}
		<div class="flex flex-col gap-3">
			<div class="flex flex-col gap-3 rounded-card bg-surface p-[18px] shadow-card">
				<TextField
					label={m.household_invite_note()}
					placeholder={m.household_invite_placeholder()}
					bind:value={note}
					maxlength={60}
				/>
				<Button disabled={busy} onclick={create}>{m.household_invite_button()}</Button>
				<div class={['collapse-row -mt-3', link && 'open']}>
					<div inert={!link}>
						<div class="flex flex-col gap-2 pt-3">
							<div class="flex items-center gap-2 rounded-input bg-surface2 py-2.5 pr-2.5 pl-3.5">
								<span
									class="min-w-0 flex-1 truncate font-mono text-[0.8125rem]"
									data-testid="invite-link">{link}</span
								>
								<button
									type="button"
									onclick={copy}
									class="min-h-11 shrink-0 rounded-small bg-surface px-3 text-[0.875rem] font-[650]"
									>{m.common_copy()}</button
								>
							</div>
							<p class="text-[0.8125rem] text-muted">{m.household_invite_ready()}</p>
						</div>
					</div>
				</div>
			</div>
			{#if invites.length > 0}
				<div class="rounded-card bg-surface px-[18px] pb-1 shadow-card">
					<h3 class="pt-2.5 pb-0.5 text-[0.78125rem] font-[650] text-muted">
						{m.household_invites()}
					</h3>
					<ul class="flex flex-col divide-y divide-line">
						{#each invites as i (i.id)}
							{@const Icon = live(i) ? Link : i.usedAt ? UserCheck : Link2Off}
							<li
								class="grid min-h-16 grid-cols-[40px_minmax(0,1fr)_auto] items-center gap-3 py-2 large:grid-cols-[40px_minmax(0,1fr)]"
							>
								<span class="grid size-10 place-items-center rounded-small bg-surface2 text-muted"
									><Icon size={18} aria-hidden="true" /></span
								>
								<span class="min-w-0">
									<b class="block truncate text-[0.9375rem] font-semibold"
										>{i.note
											? m.household_invite_for({ name: i.note })
											: m.household_invite_any()}</b
									>
									<small class="block text-[0.8125rem] text-muted">{status(i)}</small>
								</span>
								{#if live(i)}
									<button
										type="button"
										disabled={busy}
										aria-label={m.household_revoke()}
										onclick={() => revoke(i)}
										class="min-h-11 text-[0.875rem] font-bold text-bad">{m.common_cancel()}</button
									>
								{/if}
							</li>
						{/each}
					</ul>
				</div>
			{/if}
		</div>
	</section>

	{#if backups}
		<section aria-labelledby="backups-label">
			{@render label(m.household_backups(), 'backups-label')}
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
						{m.household_backups_ok()}
					</p>
				{/if}
				{@render facts([
					[m.household_backups_last(), when(backups.lastSuccessfulBackupAt)],
					[m.household_backups_check(), when(backups.lastRestoreCheckAt)],
					[
						m.household_backups_offsite(),
						backups.offsiteConfigured
							? m.household_backups_offsite_on()
							: m.household_backups_offsite_none()
					]
				])}
			</div>
		</section>
	{/if}

	<section aria-labelledby="scans-label">
		{@render label(m.household_scans(), 'scans-label')}
		<div class="flex flex-col gap-2 rounded-card bg-surface p-[18px] shadow-card">
			<p class="text-[0.8125rem] text-muted">{m.household_scans_body()}</p>
			{#if data.scanTotals.scans === 0}
				<p class="text-[0.875rem] text-muted">{m.household_scans_none()}</p>
			{:else}
				{@const t = data.scanTotals}
				{@const share = (part: number, whole: number) =>
					whole ? ` (${Math.round((part / whole) * 100)} %)` : ''}
				{@render facts(
					[
						[m.household_scans_saved(), `${t.scans}`],
						[
							m.household_scans_without_edits(),
							`${t.withoutEdits}${share(t.withoutEdits, t.scans)}`
						],
						[m.household_scans_values(), `${t.proposed}`],
						[m.household_scans_changed(), `${t.changed}${share(t.changed, t.proposed)}`],
						[m.household_scans_removed(), `${t.removed}${share(t.removed, t.proposed)}`],
						[m.household_scans_added(), `${t.added}`],
						[m.household_scans_basis_unknown(), `${t.basisUnknown}`],
						[m.household_scans_basis_changed(), `${t.basisChanged}`]
					],
					'scan-totals'
				)}
			{/if}
		</div>
	</section>

	<section aria-labelledby="deleted-label">
		{@render label(m.household_deletions(), 'deleted-label')}
		<div class="flex flex-col gap-2 rounded-card bg-surface p-[18px] shadow-card">
			{#if deletions.length === 0}
				<p class="text-[0.9375rem] font-semibold">{m.household_deletions_none()}</p>
			{:else}
				<ul class="flex flex-col divide-y divide-line" data-testid="deletions">
					{#each deletions as d (d.accountId)}
						<li class="flex flex-col py-2">
							<span class="font-mono text-[0.8125rem] break-all">{d.accountId}</span>
							<span class="text-[0.8125rem] text-muted"
								>{date(d.deletedAt)}{d.removedSharedFoods
									? ` · ${m.household_deletions_shared_removed()}`
									: ''}</span
							>
						</li>
					{/each}
				</ul>
			{/if}
			<p class="text-[0.8125rem] text-muted">{m.household_deletions_body()}</p>
		</div>
	</section>
</main>

{#if deleting}
	{@const member = deleting}
	<Sheet
		title={m.household_delete_title({ name: member.displayName })}
		onclose={() => (deleting = null)}
	>
		<p class="text-[0.9375rem]">{m.household_delete_body()}</p>
		<Chips
			label={m.data_delete_shared()}
			bind:value={removeShared}
			options={[
				{ value: 'keep', label: m.data_delete_keep() },
				{ value: 'remove', label: m.data_delete_remove() }
			]}
		/>
		<p class="text-[0.8125rem] text-muted">{m.data_delete_backups()}</p>
		{#if problem}<Notice>{problem}</Notice>{/if}
		<label class="flex min-h-11 items-center gap-3 text-[0.9375rem] font-semibold">
			<input type="checkbox" bind:checked={understood} class="size-5 accent-[var(--bad)]" />
			{m.data_delete_confirm_check()}
		</label>
		<Button variant="danger" disabled={busy || !understood} onclick={() => deleteMember(member)}
			>{m.data_delete_confirm_button()}</Button
		>
		<Button variant="ghost" onclick={() => (deleting = null)}>{m.common_cancel()}</Button>
	</Sheet>
{/if}
