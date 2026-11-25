<script lang="ts">
	import { m } from '#lib/paraglide/messages.js';
	import RecipeEditor from '#lib/ui/recipes/RecipeEditor.svelte';

	let { data } = $props();
</script>

<svelte:head><title>{data.recipe.name} · {m.app_name()}</title></svelte:head>

<main class="mx-auto flex max-w-[640px] flex-col gap-3 px-3.5 py-4 desk:px-7">
	<!-- Another recipe (Undo can open one), a new version (after Update to current food values), or Restore, starts
	the editor afresh (2026-11-25 Review.md audit, 1.1). -->
	{#key `${data.recipe.id}-${data.recipe.version}-${data.recipe.archived}`}
		<RecipeEditor recipe={data.recipe} stale={data.stale} />
	{/key}
</main>
