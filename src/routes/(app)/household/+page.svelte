<script lang="ts">
	import { resolve } from '$app/paths';
	import { onMount } from 'svelte';
	import { m } from '#lib/paraglide/messages.js';
	import { api } from '#lib/client/api.ts';
	import { describeError, withRecentAuth } from '#lib/client/passkeys.ts';
	import Button from '#lib/ui/Button.svelte';
	import Card from '#lib/ui/Card.svelte';
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

	let invites = $state<Invite[]>([]);
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
</main>
