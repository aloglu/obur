<script lang="ts">
	import PageHead from '#lib/ui/PageHead.svelte';
	import { resolve } from '$app/paths';
	import { onMount } from 'svelte';
	import { invalidateAll } from '$app/navigation';
	import { m } from '#lib/paraglide/messages.js';
	import { api } from '#lib/client/api.ts';
	import { describeError, register, suggestedLabel, withRecentAuth } from '#lib/client/passkeys.ts';
	import Button from '#lib/ui/Button.svelte';
	import Card from '#lib/ui/Card.svelte';
	import Notice from '#lib/ui/Notice.svelte';
	import RecoveryCodes from '#lib/ui/RecoveryCodes.svelte';
	import TextField from '#lib/ui/TextField.svelte';

	interface Credential {
		id: string;
		label: string;
		deviceType: 'singleDevice' | 'multiDevice';
		createdAt: string;
		lastUsedAt: string | null;
	}

	let { data } = $props();
	const credentials = $derived(data.credentials as Credential[]);
	const remaining = $derived(data.remaining);
	let label = $state('');
	let problem = $state('');
	let info = $state('');
	let busy = $state(false);
	let newCodes = $state<string[] | undefined>();

	const date = (iso: string) =>
		new Date(iso).toLocaleDateString(undefined, { dateStyle: 'medium' });

	// The lists come with the page; after a change, the page's data is fetched again.
	const refresh = () => invalidateAll();

	onMount(() => {
		label = suggestedLabel();
	});

	async function run(action: () => Promise<void>) {
		busy = true;
		problem = '';
		info = '';
		try {
			await withRecentAuth(action);
			await refresh();
		} catch (e) {
			problem = describeError(e);
		} finally {
			busy = false;
		}
	}

	const add = () => run(() => register('credentials', {}, { label }));

	const remove = (c: Credential) => {
		if (!confirm(m.security_remove_confirm({ label: c.label }))) return;
		return run(() => api('POST', '/api/v1/auth/credentials/remove', { id: c.id }));
	};

	const regenerate = () => {
		if (!confirm(m.security_codes_new_confirm())) return;
		return run(async () => {
			newCodes = (await api<{ recoveryCodes: string[] }>('POST', '/api/v1/auth/recovery-codes'))
				.recoveryCodes;
		});
	};

	const signOutOthers = () =>
		run(async () => {
			const r = await api<{ signedOut: number }>('POST', '/api/v1/auth/sessions/sign-out-others');
			info = m.security_signed_out_others({ count: r.signedOut });
		});
</script>

<svelte:head><title>{m.security_title()} · {m.app_name()}</title></svelte:head>

<main class="mx-auto flex max-w-[640px] flex-col gap-3 px-3.5 py-4 desk:px-7">
	<PageHead
		href={resolve('/(app)/more/settings')}
		label={m.settings_title()}
		title={m.security_title()}
	/>
	{#if problem}<Notice>{problem}</Notice>{/if}
	{#if info}<Notice tone="info">{info}</Notice>{/if}

	{#if newCodes}
		<Card><RecoveryCodes codes={newCodes} ondone={() => (newCodes = undefined)} /></Card>
	{/if}

	<Card title={m.security_passkeys()}>
		<ul class="flex flex-col divide-y divide-line">
			{#each credentials as c (c.id)}
				<li class="flex min-h-14 items-center justify-between gap-3 py-2">
					<div class="min-w-0">
						<p class="truncate text-[0.9375rem] font-semibold">{c.label}</p>
						<p class="text-[0.8125rem] text-muted">
							{c.deviceType === 'multiDevice' ? m.security_synced() : m.security_device_bound()} ·
							{m.security_added({ date: date(c.createdAt) })}{#if c.lastUsedAt}, {m.security_last_used(
									{ date: date(c.lastUsedAt) }
								)}{/if}
						</p>
					</div>
					<Button variant="danger" disabled={busy} onclick={() => remove(c)}
						>{m.security_remove()}</Button
					>
				</li>
			{/each}
		</ul>
		<p class="text-[0.8125rem] text-muted">{m.security_add_hint()}</p>
		<TextField label={m.field_passkey_label()} bind:value={label} maxlength={40} />
		<Button variant="ghost" disabled={busy} onclick={add}>{m.security_add()}</Button>
	</Card>

	<Card title={m.security_codes()}>
		{#if remaining !== undefined}<p class="text-[0.9375rem]">
				{m.security_codes_remaining({ count: remaining })}
			</p>{/if}
		<Button variant="ghost" disabled={busy} onclick={regenerate}>{m.security_codes_new()}</Button>
	</Card>

	<Card title={m.security_sessions()}>
		<Button variant="ghost" disabled={busy} onclick={signOutOthers}
			>{m.security_sign_out_others()}</Button
		>
	</Card>
</main>
