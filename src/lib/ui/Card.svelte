<script lang="ts">
	import type { Snippet } from 'svelte';

	let { title, children }: { title?: string; children: Snippet } = $props();
</script>

<section class="flex flex-col gap-3 rounded-card bg-surface p-[18px] shadow-card">
	{#if title}<h2 class="text-[1.1875rem] font-bold">{title}</h2>{/if}
	{@render children()}
</section>
