<script lang="ts">
	import KeyRound from '@lucide/svelte/icons/key-round';
	import { resolve } from '$app/paths';
	import { onMount } from 'svelte';
	import { goto, invalidateAll } from '$app/navigation';
	import { m } from '#lib/paraglide/messages.js';
	import { ApiError } from '#lib/client/api.ts';
	import {
		describeError,
		register,
		suggestedLabel,
		takeFragmentToken
	} from '#lib/client/passkeys.ts';
	import { showToast } from '#lib/client/toast.svelte.ts';
	import AuthShell from '#lib/ui/AuthShell.svelte';
	import Button from '#lib/ui/Button.svelte';
	import Notice from '#lib/ui/Notice.svelte';
	import RecoveryCodes from '#lib/ui/RecoveryCodes.svelte';
	import TextField from '#lib/ui/TextField.svelte';

	let token = $state<string | undefined>();
	let ready = $state(false);
	let name = $state('');
	let label = $state('');
	let busy = $state(false);
	let problem = $state('');
	let codes = $state<string[] | undefined>();

	onMount(() => {
		token = takeFragmentToken();
		label = suggestedLabel();
		ready = true;
	});

	async function create(event: SubmitEvent) {
		event.preventDefault();
		busy = true;
		problem = '';
		try {
			const result = await register<{ recoveryCodes: string[] }>(
				'join',
				{ token, displayName: name },
				{ token, label }
			);
			codes = result.recoveryCodes;
		} catch (e) {
			problem =
				e instanceof ApiError && e.code === 'invite_unavailable'
					? m.join_unavailable()
					: describeError(e);
		} finally {
			busy = false;
		}
	}

	async function finish() {
		await invalidateAll();
		await goto(resolve('/(app)'));
		showToast({
			message: m.welcome_toast({ name: name.trim() }),
			detail: m.welcome_toast_detail()
		});
	}
</script>

<AuthShell title={codes ? m.codes_title() : m.join_title()} brand={!codes}>
	{#if codes}
		<RecoveryCodes {codes} ondone={finish} />
	{:else if ready && !token}
		<Notice>{m.join_missing()}</Notice>
	{:else if ready}
		{#if problem}<Notice>{problem}</Notice>{/if}
		<form class="flex flex-col gap-3.5" onsubmit={create}>
			<div class="flex flex-col gap-4 rounded-card bg-surface p-[18px] shadow-card">
				<TextField
					label={m.field_display_name()}
					bind:value={name}
					required
					maxlength={80}
					autocomplete="name"
				/>
				<TextField label={m.field_passkey_label()} bind:value={label} maxlength={40} />
			</div>
			<Button type="submit" wide disabled={busy || !name.trim()}>
				<KeyRound size={20} aria-hidden="true" />
				{busy ? m.common_working() : m.join_button()}
			</Button>
		</form>
	{/if}
</AuthShell>
