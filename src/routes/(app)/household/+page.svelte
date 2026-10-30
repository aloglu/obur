<script lang="ts">
	import { resolve } from '$app/paths';
	import { onMount } from 'svelte';
	import { m } from '#lib/paraglide/messages.js';
	import { api } from '#lib/client/api.ts';
	import { describeError, withRecentAuth } from '#lib/client/passkeys.ts';
	import Button from '#lib/ui/Button.svelte';
	import Card from '#lib/ui/Card.svelte';
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
	let copied = $state(false);
	let busy = $state(false);
	let problem = $state('');

	const date = (iso: string) =>
		new Date(iso).toLocaleDateString(undefined, { dateStyle: 'medium' });

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
			copied = false;
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
	const when = (iso: string | null) =>
		iso
			? new Date(iso).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })
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
		await navigator.clipboard.writeText(link);
		copied = true;
	}
</script>

<svelte:head><title>{m.household_title()} · {m.app_name()}</title></svelte:head>

<main class="mx-auto flex min-h-dvh max-w-[520px] flex-col gap-3 px-3.5 py-6">
	<a href={resolve('/(app)')} class="text-[14px] font-semibold text-accent">← {m.app_name()}</a>
	<h1 class="text-[24px] font-[750]">{m.household_title()}</h1>
	{#if problem}<Notice>{problem}</Notice>{/if}

	{#if backups}
		<Card title={m.household_backups()}>
			{#each backups.problems as p (p)}
				<Notice tone={p === 'not_configured' || p === 'no_status' ? 'info' : 'warn'}>
					{problemText[p]()}
				</Notice>
			{/each}
			{#if backups.problems.length === 0}
				<p class="text-[15px] font-semibold">{m.household_backups_ok()}</p>
			{/if}
			<p class="text-[14px] text-muted">
				{m.household_backups_times({
					backup: when(backups.lastSuccessfulBackupAt),
					check: when(backups.lastRestoreCheckAt)
				})}
			</p>
		</Card>
	{/if}

	<Card title={m.household_members()}>
		<ul class="flex flex-col divide-y divide-line">
			{#each members as member (member.id)}
				<li class="flex min-h-14 items-center justify-between gap-3 py-2">
					<div class="min-w-0">
						<p class="truncate text-[15px] font-semibold">{member.displayName}</p>
						<p class="text-[13px] text-muted">
							{member.id === data.user?.id
								? m.household_you()
								: member.role === 'admin'
									? m.household_admin()
									: ''}
						</p>
					</div>
					{#if member.id !== data.user?.id}
						<Button
							variant="danger"
							disabled={busy}
							onclick={() => ((deleting = member), (removeShared = 'keep'))}
							>{m.household_delete_member()}</Button
						>
					{/if}
				</li>
			{/each}
		</ul>
	</Card>

	<Card title={m.household_invite()}>
		<TextField label={m.household_invite_note()} bind:value={note} maxlength={60} />
		<Button disabled={busy} onclick={create}>{m.household_invite_button()}</Button>
		{#if link}
			<p class="text-[14px] text-muted">{m.household_invite_ready()}</p>
			<p
				class="rounded-small bg-surface2 p-3 font-mono text-[13px] break-all"
				data-testid="invite-link"
			>
				{link}
			</p>
			<Button variant="ghost" onclick={copy}>{copied ? m.common_copied() : m.common_copy()}</Button>
		{/if}
	</Card>

	<Card title={m.household_invites()}>
		{#if invites.length === 0}
			<p class="text-[14px] text-muted">{m.household_none()}</p>
		{:else}
			<ul class="flex flex-col divide-y divide-line">
				{#each invites as i (i.id)}
					<li class="flex min-h-14 items-center justify-between gap-3 py-2">
						<div class="min-w-0">
							<p class="truncate text-[15px] font-semibold">{i.note ?? '—'}</p>
							<p class="text-[13px] text-muted">{status(i)}</p>
						</div>
						{#if !i.usedAt && !i.revokedAt && new Date(i.expiresAt) > new Date()}
							<Button variant="danger" disabled={busy} onclick={() => revoke(i)}
								>{m.household_revoke()}</Button
							>
						{/if}
					</li>
				{/each}
			</ul>
		{/if}
	</Card>
	<Card title={m.household_deletions()}>
		<p class="text-[14px] text-muted">{m.household_deletions_body()}</p>
		{#if deletions.length === 0}
			<p class="text-[14px] text-muted">{m.household_deletions_none()}</p>
		{:else}
			<ul class="flex flex-col divide-y divide-line" data-testid="deletions">
				{#each deletions as d (d.accountId)}
					<li class="flex flex-col py-2">
						<span class="font-mono text-[13px] break-all">{d.accountId}</span>
						<span class="text-[13px] text-muted"
							>{date(d.deletedAt)}{d.removedSharedFoods
								? ` · ${m.household_deletions_shared_removed()}`
								: ''}</span
						>
					</li>
				{/each}
			</ul>
		{/if}
	</Card>
</main>

{#if deleting}
	{@const member = deleting}
	<Sheet
		title={m.household_delete_title({ name: member.displayName })}
		onclose={() => (deleting = null)}
	>
		<p class="text-[15px]">{m.household_delete_body()}</p>
		<p class="text-[14px] text-muted">{m.data_delete_backups()}</p>
		<Chips
			label={m.data_delete_shared()}
			bind:value={removeShared}
			options={[
				{ value: 'keep', label: m.data_delete_keep() },
				{ value: 'remove', label: m.data_delete_remove() }
			]}
		/>
		{#if problem}<Notice>{problem}</Notice>{/if}
		<Button variant="danger" disabled={busy} onclick={() => deleteMember(member)}
			>{m.data_delete_confirm_button()}</Button
		>
		<Button variant="ghost" onclick={() => (deleting = null)}>{m.common_cancel()}</Button>
	</Sheet>
{/if}
