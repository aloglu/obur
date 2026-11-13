<script lang="ts">
	import Check from '@lucide/svelte/icons/check';
	import Link from '@lucide/svelte/icons/link';
	import { resolve } from '$app/paths';
	import { onMount } from 'svelte';
	import { m } from '#lib/paraglide/messages.js';
	import { api, ApiError } from '#lib/client/api.ts';
	import { describeError, withRecentAuth } from '#lib/client/passkeys.ts';
	import { clockTime } from '#lib/client/prefs.ts';
	import { showToast } from '#lib/client/toast.svelte.ts';
	import { shortDate } from '#lib/shared/format.ts';
	import PageHead from '#lib/ui/PageHead.svelte';
	import Button from '#lib/ui/Button.svelte';
	import Chips from '#lib/ui/Chips.svelte';
	import Sheet from '#lib/ui/Sheet.svelte';
	import type { BackupProblem, BackupReport } from '#lib/shared/backup-health.ts';
	import type { UpdateStatus } from '#lib/server/modules/updates/index.ts';
	import Notice from '#lib/ui/Notice.svelte';
	import Switch from '#lib/ui/Switch.svelte';
	import TextField from '#lib/ui/TextField.svelte';
	import { untrack } from 'svelte';
	import { invalidateAll } from '$app/navigation';

	// Only invites still waiting: used, cancelled and expired ones are not listed.
	interface Invite {
		id: string;
		note: string | null;
		expiresAt: string;
	}

	interface Member {
		id: string;
		displayName: string;
		role: 'admin' | 'member';
		createdAt: string;
		sharedFoods: number;
	}
	interface Deletion {
		accountId: string;
		deletedAt: string;
		by: 'self' | 'admin';
		removedSharedFoods: boolean;
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
			({ updates } = await api<{ updates: UpdateStatus }>('PUT', '/api/v1/household/update-check', {
				on
			}));
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
			await withRecentAuth(() => api('PUT', '/api/v1/household/personal-keys', { allow }));
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
		offsite_behind: m.backup_offsite_behind,
		offsite_gap: m.backup_offsite_gap,
		archive_failing: m.backup_archive_failing,
		restore_check_failed: m.backup_restore_check_failed,
		restore_check_stale: m.backup_restore_check_stale,
		offsite_restore_failed: m.backup_offsite_restore_failed,
		offsite_restore_stale: m.backup_offsite_restore_stale,
		no_offsite: m.backup_no_offsite
	};
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

	async function copyText(text: string, message: string, detail: string) {
		try {
			await navigator.clipboard.writeText(text);
			showToast({ message, detail });
		} catch {
			showToast({ message: m.household_copy_failed(), detail: m.household_copy_failed_detail() });
		}
	}
	const copy = () => copyText(link, m.household_copied(), m.household_copied_detail());
	// The entries as `obur restore finish` takes them: <ID>[:shared]@<deletion date>.
	const copyDeletions = () =>
		copyText(
			deletions
				.map(
					(d) =>
						`${d.accountId}${d.removedSharedFoods ? ':shared' : ''}@${d.deletedAt.slice(0, 10)}`
				)
				.join(' '),
			m.household_deletions_copied(),
			m.household_deletions_copied_detail()
		);
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
		<PageHead href={resolve('/(app)/more')} label={m.nav_more()} title={m.household_title()} />
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
							<li
								class="grid min-h-16 grid-cols-[40px_minmax(0,1fr)_auto] items-center gap-3 py-2 large:grid-cols-[40px_minmax(0,1fr)]"
							>
								<span class="grid size-10 place-items-center rounded-small bg-surface2 text-muted"
									><Link size={18} aria-hidden="true" /></span
								>
								<span class="min-w-0">
									<b class="block truncate text-[0.9375rem] font-semibold"
										>{i.note
											? m.household_invite_for({ name: i.note })
											: m.household_invite_any()}</b
									>
									<small class="block text-[0.8125rem] text-muted"
										>{m.household_status_pending({ date: date(i.expiresAt) })}</small
									>
								</span>
								<button
									type="button"
									disabled={busy}
									aria-label={m.household_revoke()}
									onclick={() => revoke(i)}
									class="min-h-11 text-[0.875rem] font-bold text-bad">{m.common_cancel()}</button
								>
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
					backups.offsiteConfigured
						? [m.household_backups_offsite_check(), when(backups.lastOffsiteRestoreCheckAt)]
						: [m.household_backups_offsite(), m.household_backups_offsite_none()]
				])}
				<div class="flex flex-col gap-1.5 border-t border-line pt-3" data-testid="deleted-accounts">
					<div class="flex items-center justify-between gap-3">
						<h3 class="text-[0.9375rem] font-semibold">{m.household_deletions()}</h3>
						{#if deletions.length > 0}
							<button
								type="button"
								onclick={copyDeletions}
								class="min-h-11 shrink-0 text-[0.875rem] font-bold text-accent"
								>{m.household_deletions_copy()}</button
							>
						{/if}
					</div>
					<p class="text-[0.8125rem] leading-snug text-muted">{m.household_deletions_body()}</p>
					{#if deletions.length === 0}
						<p class="py-1 text-[0.875rem] text-muted">{m.household_deletions_none()}</p>
					{:else}
						<ul class="flex flex-col divide-y divide-line" data-testid="deletions">
							{#each deletions as d (d.accountId)}
								<li class="flex flex-col py-2">
									<span class="font-mono text-[0.8125rem] break-all">{d.accountId}</span>
									<span class="text-[0.8125rem] text-muted"
										>{[
											date(d.deletedAt),
											d.by === 'self'
												? m.household_deletions_by_self()
												: m.household_deletions_by_admin(),
											...(d.removedSharedFoods ? [m.household_deletions_shared_removed()] : [])
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
		{@render label(m.household_updates(), 'updates-label')}
		<div class="flex flex-col gap-3 rounded-card bg-surface p-[18px] shadow-card">
			{#if updates.latest}
				<Notice tone="info" title={m.household_updates_newer({ version: updates.latest })}>
					<a
						href="https://github.com/aloglu/obur/blob/main/docs/install/updating.md"
						target="_blank"
						rel="noreferrer"
						class="font-semibold text-accent underline">{m.household_updates_how()}</a
					>
				</Notice>
			{/if}
			<Switch
				label={m.household_updates_check()}
				detail={m.household_updates_check_line()}
				bind:checked={updateCheck}
				onchange={saveUpdateCheck}
			/>
			{@render facts(
				[
					[m.household_updates_current(), updates.current],
					...(updates.check && !checking
						? [
								[
									m.household_updates_checked(),
									updates.checkedAt
										? updates.latest
											? when(updates.checkedAt)
											: m.household_updates_none({ when: when(updates.checkedAt) })
										: m.household_updates_unreachable()
								] as [string, string]
							]
						: [])
				],
				'update-facts'
			)}
		</div>
	</section>

	<section aria-labelledby="keys-label">
		{@render label(m.household_personal_keys(), 'keys-label')}
		<div class="flex flex-col gap-3 rounded-card bg-surface p-[18px] shadow-card">
			<Switch
				label={m.household_personal_keys()}
				detail={m.household_personal_keys_line()}
				bind:checked={personalKeys}
				onchange={savePersonalKeys}
			/>
			{#if !personalKeys}
				<p class="text-[0.8125rem] leading-snug text-muted">{m.household_personal_keys_off()}</p>
			{/if}
		</div>
	</section>

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
</main>

{#if deleting}
	{@const member = deleting}
	<Sheet
		title={m.household_delete_title({ name: member.displayName })}
		onclose={() => (deleting = null)}
	>
		<p class="text-[0.9375rem]">{m.household_delete_body()}</p>
		<!-- Asked only when there is something to decide (owner, 2026-11-10). -->
		{#if member.sharedFoods > 0}
			<Chips
				label={member.sharedFoods === 1
					? m.household_delete_shared_one({ name: member.displayName })
					: m.household_delete_shared({
							name: member.displayName,
							count: String(member.sharedFoods)
						})}
				bind:value={removeShared}
				options={[
					{ value: 'keep', label: m.data_delete_keep() },
					{ value: 'remove', label: m.data_delete_remove() }
				]}
			/>
			<p class="text-[0.8125rem] text-muted">{m.data_delete_shared_note()}</p>
		{/if}
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
