<script lang="ts">
	// Set up, Join and Recover (docs/ui.md, "Signing in and first day"): the app's icon and name, a centred title, then the
	// page's own cards and buttons. The recovery codes step keeps only the title.
	import type { Snippet } from 'svelte';
	import { m } from '#lib/paraglide/messages.js';

	interface Props {
		title: string;
		lead?: string;
		brand?: boolean;
		children: Snippet;
	}
	let { title, lead, brand = true, children }: Props = $props();
</script>

<svelte:head><title>{title} · {m.app_name()}</title></svelte:head>

<main
	class="mx-auto flex min-h-dvh w-full max-w-[440px] flex-col gap-3.5 px-3.5 pt-[max(24px,env(safe-area-inset-top))] pb-[max(24px,env(safe-area-inset-bottom))]"
>
	{#if brand}
		<div class="mt-5 mb-2.5 flex flex-col items-center gap-2.5">
			<img src="/icon-192.png" alt="" width="76" height="76" class="rounded-[18px] shadow-card" />
			<p class="font-display text-[22px] font-extrabold tracking-[-0.02em] text-muted">
				{m.app_name()}
			</p>
		</div>
	{/if}
	<h1 class={['text-center text-[28px] font-[750] text-balance', !brand && 'mt-4']}>{title}</h1>
	{#if lead}<p class="-mt-1 mb-1.5 text-center text-[15px] text-balance text-muted">{lead}</p>{/if}
	{@render children()}
</main>
