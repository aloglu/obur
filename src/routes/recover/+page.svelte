<script lang="ts">
	import { resolve } from '$app/paths';
	import { onMount, untrack } from 'svelte';
	import { goto, invalidateAll } from '$app/navigation';
	import { m } from '#lib/paraglide/messages.js';
	import { api, ApiError } from '#lib/client/api.ts';
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

	let { data } = $props();

	// Starting stage only; the page then moves through the stages itself.
	let stage = $state<'code' | 'enrol' | 'codes'>(untrack(() => data.recovering) ? 'enrol' : 'code');
	let viaLink = $state(false);
	let code = $state('');
	let label = $state('');
	let busy = $state(false);
	let problem = $state('');
	let codes = $state<string[]>([]);

	async function begin(body: { code?: string; linkToken?: string }) {
		busy = true;
		problem = '';
		try {
			await api('POST', '/api/v1/auth/recovery/begin', body);
			stage = 'enrol';
		} catch (e) {
			problem =
				e instanceof ApiError && e.code === 'recovery_unavailable'
					? m.recover_invalid()
					: describeError(e);
		} finally {
			busy = false;
		}
	}

	onMount(() => {
		label = suggestedLabel();
		const linkToken = takeFragmentToken();
		if (linkToken && stage === 'code') {
			viaLink = true;
			begin({ linkToken });
		}
	});

	async function enrol() {
		busy = true;
		problem = '';
		try {
			const result = await register<{ recoveryCodes: string[] }>('recovery', {}, { label });
			codes = result.recoveryCodes;
			stage = 'codes';
		} catch (e) {
			if (e instanceof ApiError && (e.status === 401 || e.code === 'forbidden')) {
				stage = 'code';
				problem = m.recover_expired();
			} else problem = describeError(e);
		} finally {
			busy = false;
		}
	}

	async function finish() {
		await invalidateAll();
		await goto(resolve('/'));
	}
</script>

<AuthShell
	title={m.recover_title()}
	body={stage === 'code' ? (viaLink ? m.recover_link_body() : m.recover_body()) : undefined}
>
	{#if problem}<Notice>{problem}</Notice>{/if}
	{#if stage === 'code'}
		<form
			class="flex flex-col gap-4"
			onsubmit={(e) => {
				e.preventDefault();
				begin({ code });
			}}
		>
			<TextField
				label={m.recover_code()}
				bind:value={code}
				autocomplete="one-time-code"
				autocapitalize="characters"
				spellcheck={false}
				placeholder="XXXX-XXXX-XXXX-XXXX"
			/>
			<Button type="submit" wide disabled={busy || code.trim().length < 16}
				>{busy ? m.common_working() : m.recover_start()}</Button
			>
		</form>
	{:else if stage === 'enrol'}
		<div class="flex flex-col gap-1">
			<h2 class="text-[17px] font-bold">{m.recover_warning_title()}</h2>
			<p class="text-[14px] text-muted">{m.recover_warning()}</p>
		</div>
		<TextField
			label={m.field_passkey_label()}
			hint={m.field_passkey_label_hint()}
			bind:value={label}
			maxlength={40}
		/>
		<Button wide disabled={busy} onclick={enrol}
			>{busy ? m.common_working() : m.recover_button()}</Button
		>
	{:else}
		<RecoveryCodes {codes} ondone={finish} />
	{/if}
</AuthShell>
