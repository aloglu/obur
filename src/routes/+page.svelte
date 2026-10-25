<script lang="ts">
	import { resolve } from '$app/paths';
	import { goto, invalidateAll } from '$app/navigation';
	import { m } from '#lib/paraglide/messages.js';
	import { api } from '#lib/client/api.ts';
	import Button from '#lib/ui/Button.svelte';
	import Card from '#lib/ui/Card.svelte';

	let { data } = $props();

	async function signOut() {
		await api('POST', '/api/v1/auth/logout', {});
		await invalidateAll();
		await goto(resolve('/login'));
	}
</script>

<svelte:head><title>{m.app_name()}</title></svelte:head>

<!-- Placeholder until the Today screen (Phase 1, step 5). -->
<main class="mx-auto flex min-h-dvh max-w-[520px] flex-col gap-3 px-3.5 py-6">
	<p class="font-display text-[30px] font-extrabold tracking-[-0.02em] text-accent">
		{m.app_name()}
	</p>
	<Card>
		<h1 class="text-[24px] font-[750]">
			{m.home_greeting({ name: data.user?.displayName ?? '' })}
		</h1>
		<p class="text-[14px] text-muted">{m.placeholder_building()}</p>
		<nav class="flex flex-col gap-2">
			<a class="font-semibold text-accent underline" href={resolve('/foods')}>{m.home_foods()}</a>
			<a class="font-semibold text-accent underline" href={resolve('/settings/security')}
				>{m.home_security()}</a
			>
			{#if data.user?.role === 'admin'}
				<a class="font-semibold text-accent underline" href={resolve('/household')}
					>{m.home_household()}</a
				>
			{/if}
		</nav>
		<Button variant="ghost" onclick={signOut}>{m.home_sign_out()}</Button>
	</Card>
</main>
