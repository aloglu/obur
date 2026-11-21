<script lang="ts">
	// docs/ui.md "Members": the people on this server and invites. Server-wide settings are on Server.
	import Link from '@lucide/svelte/icons/link';
	import { resolve } from '$app/paths';
	import { m } from '#lib/paraglide/messages.js';
	import { api } from '#lib/client/api.ts';
	import { describeError, withRecentAuth } from '#lib/client/passkeys.ts';
	import { showToast } from '#lib/client/toast.svelte.ts';
	import { shortDate } from '#lib/shared/format.ts';
	import PageHead from '#lib/ui/PageHead.svelte';
	import Button from '#lib/ui/Button.svelte';
	import Sheet from '#lib/ui/Sheet.svelte';
	import Notice from '#lib/ui/Notice.svelte';
	import TextField from '#lib/ui/TextField.svelte';
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
	}

	let { data } = $props();
	const invites = $derived(data.invites as Invite[]);
	const members = $derived(data.members as Member[]);
	let deleting = $state<Member | null>(null);
	let note = $state('');
	let link = $state('');
	let understood = $state(false);
	let busy = $state(false);
	let problem = $state('');

	const date = (iso: string) => shortDate(iso.slice(0, 10));

	// The lists come with the page; after a change, the page's data is fetched again.
	const refresh = () => invalidateAll();

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

	const deleteMember = (member: Member) =>
		run(async () => {
			await api('DELETE', '/api/v1/admin/members', { id: member.id });
			deleting = null;
		});

	const revoke = (i: Invite) => run(() => api('POST', '/api/v1/auth/invites/revoke', { id: i.id }));

	async function copyText(text: string, message: string, detail: string) {
		try {
			await navigator.clipboard.writeText(text);
			showToast({ message, detail });
		} catch {
			showToast({ message: m.members_copy_failed(), detail: m.members_copy_failed_detail() });
		}
	}
	const copy = () => copyText(link, m.members_copied(), m.members_copied_detail());
</script>

<svelte:head><title>{m.members_title()} · {m.app_name()}</title></svelte:head>

{#snippet label(text: string, id: string)}
	<h2 {id} class="mb-1.5 px-1 text-[0.8125rem] font-[650] text-muted">{text}</h2>
{/snippet}

<main class="mx-auto flex max-w-[640px] flex-col gap-4 px-3.5 py-4 desk:px-7">
	<div class="flex flex-col gap-3">
		<PageHead href={resolve('/(app)/more')} label={m.nav_more()} title={m.members_title()} />
	</div>
	{#if problem && !deleting}<Notice>{problem}</Notice>{/if}

	<section aria-label={m.members_people()}>
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
									>{m.members_you()}</span
								>{/if}
							{#if member.role === 'admin'}<span
									class="rounded-menu bg-soft px-2 py-0.5 text-[0.75rem] font-[650] text-accent"
									>{m.members_admin()}</span
								>{/if}
						</span>
						<small class="block text-[0.8125rem] text-muted"
							>{m.members_joined({ date: date(member.createdAt) })}</small
						>
					</span>
					{#if member.id !== data.user?.id}
						<button
							type="button"
							disabled={busy}
							onclick={() => ((deleting = member), (understood = false))}
							class="min-h-11 text-[0.875rem] font-bold whitespace-nowrap text-bad large:col-start-2 large:justify-self-start"
							>{m.members_delete_member()}</button
						>
					{/if}
				</li>
			{/each}
		</ul>
	</section>

	<section class="flex flex-col" aria-labelledby="invite-label">
		{@render label(m.members_invite(), 'invite-label')}
		<div class="flex flex-col gap-3">
			<div class="flex flex-col gap-3 rounded-card bg-surface p-[18px] shadow-card">
				<TextField
					label={m.members_invite_note()}
					placeholder={m.members_invite_placeholder()}
					bind:value={note}
					maxlength={60}
				/>
				<Button disabled={busy} onclick={create}>{m.members_invite_button()}</Button>
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
							<p class="text-[0.8125rem] text-muted">{m.members_invite_ready()}</p>
						</div>
					</div>
				</div>
			</div>
			{#if invites.length > 0}
				<div class="rounded-card bg-surface px-[18px] pb-1 shadow-card">
					<h3 class="pt-2.5 pb-0.5 text-[0.78125rem] font-[650] text-muted">
						{m.members_invites()}
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
										>{i.note ? m.members_invite_for({ name: i.note }) : m.members_invite_any()}</b
									>
									<small class="block text-[0.8125rem] text-muted"
										>{m.members_status_pending({ date: date(i.expiresAt) })}</small
									>
								</span>
								<button
									type="button"
									disabled={busy}
									aria-label={m.members_revoke()}
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
</main>

{#if deleting}
	{@const member = deleting}
	<Sheet
		title={m.members_delete_title({ name: member.displayName })}
		onclose={() => (deleting = null)}
	>
		<p class="text-[0.9375rem]">{m.members_delete_body()}</p>
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
