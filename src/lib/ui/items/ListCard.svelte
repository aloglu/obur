<script lang="ts">
	// The Foods, Recipes and Saved meals lists (docs/ui.md, "Recipes and saved meals"): one card with a small head, the
	// list's name on the left and what the numbers are on the right.
	import type { Snippet } from 'svelte';

	let { title, unit, children }: { title: string; unit: string; children: Snippet } = $props();
</script>

<section class="flex flex-col rounded-card bg-surface px-[18px] pb-2 shadow-card">
	<div class="flex justify-between gap-3 pt-2.5 pb-0.5 text-[0.78125rem] font-[650] text-muted">
		<h2>{title}</h2>
		<span>{unit}</span>
	</div>
	<ul class="-mx-2.5 flex flex-col">{@render children()}</ul>
</section>
