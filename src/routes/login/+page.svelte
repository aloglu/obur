<script lang="ts">
	import { resolve } from '$app/paths';
	import { goto, invalidateAll } from '$app/navigation';
	import { m } from '#lib/paraglide/messages.js';
	import { describeError, passkeysSupported, signIn } from '#lib/client/passkeys.ts';
	import AuthShell from '#lib/ui/AuthShell.svelte';
	import Button from '#lib/ui/Button.svelte';
	import Notice from '#lib/ui/Notice.svelte';

	let busy = $state(false);
	let problem = $state('');

	async function start() {
		busy = true;
		problem = '';
		try {
			await signIn();
			await invalidateAll();
			await goto(resolve('/'));
		} catch (e) {
			problem = describeError(e);
		} finally {
			busy = false;
		}
	}
</script>

<AuthShell title={m.login_title()} body={m.login_body()}>
	{#if !passkeysSupported()}<Notice>{m.error_unsupported()}</Notice>{/if}
	{#if problem}<Notice>{problem}</Notice>{/if}
	<Button wide disabled={busy} onclick={start}
		>{busy ? m.common_working() : m.login_button()}</Button
	>
	<p class="text-center text-[14px] text-muted">
		{m.login_lost()}
		<a class="font-semibold text-accent underline" href={resolve('/recover')}
			>{m.login_use_recovery()}</a
		>
	</p>
</AuthShell>
