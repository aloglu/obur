<script lang="ts">
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
				'setup',
				{ token, displayName: name },
				{ token, label }
			);
			codes = result.recoveryCodes;
		} catch (e) {
			problem =
				e instanceof ApiError && e.code === 'setup_unavailable'
					? m.setup_unavailable()
					: describeError(e);
		} finally {
			busy = false;
		}
	}

	async function finish() {
		await invalidateAll();
		await goto(resolve('/(app)'));
	}
</script>

<AuthShell title={m.setup_title()} body={codes ? undefined : m.setup_body()}>
	{#if codes}
		<RecoveryCodes {codes} ondone={finish} />
	{:else if ready && !token}
		<Notice>{m.setup_missing()}</Notice>
	{:else if ready}
		{#if problem}<Notice>{problem}</Notice>{/if}
		<form class="flex flex-col gap-4" onsubmit={create}>
			<TextField
				label={m.field_display_name()}
				hint={m.field_display_name_hint()}
				bind:value={name}
				required
				maxlength={80}
				autocomplete="name"
			/>
			<TextField
				label={m.field_passkey_label()}
				hint={m.field_passkey_label_hint()}
				bind:value={label}
				maxlength={40}
			/>
			<Button type="submit" wide disabled={busy || !name.trim()}
				>{busy ? m.common_working() : m.setup_button()}</Button
			>
		</form>
	{/if}
</AuthShell>
