<script lang="ts">
	import type { Snippet } from 'svelte';
	import { m } from '#lib/paraglide/messages.js';
	import AppLogo from './AppLogo.svelte';

	let { title, body, children }: { title: string; body?: string; children: Snippet } = $props();
</script>

<svelte:head><title>{title} · {m.app_name()}</title></svelte:head>

<main
	class="mx-auto flex min-h-dvh w-full max-w-[440px] flex-col justify-center gap-4 px-3.5 py-[max(24px,env(safe-area-inset-top))]"
>
	<p
		class="flex items-center gap-2.5 font-display text-[30px] font-extrabold tracking-[-0.02em] text-accent"
	>
		<AppLogo size={36} />{m.app_name()}
	</p>
	<div class="flex flex-col gap-1">
		<h1 class="text-[24px] font-[750]">{title}</h1>
		{#if body}<p class="text-[15px] text-muted">{body}</p>{/if}
	</div>
	<div class="flex flex-col gap-4 rounded-card bg-surface p-[18px] shadow-card">
		{@render children()}
	</div>
</main>
