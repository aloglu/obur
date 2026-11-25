<script lang="ts">
	import { m } from '#lib/paraglide/messages.js';
	import SavedMealEditor from '#lib/ui/meals/SavedMealEditor.svelte';

	let { data } = $props();
</script>

<svelte:head><title>{data.meal.name} · {m.app_name()}</title></svelte:head>

<main class="mx-auto flex max-w-[640px] flex-col gap-3 px-3.5 py-4 desk:px-7">
	<!-- Another saved meal (Undo can open one) or a new revision (after Update to current food values) starts the
	editor afresh (2026-11-25 Review.md audit, 1.1). -->
	{#key `${data.meal.id}-${data.meal.revision}`}
		<SavedMealEditor meal={data.meal} stale={data.stale} />
	{/key}
</main>
