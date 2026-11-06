<script lang="ts">
	import { m } from '#lib/paraglide/messages.js';
	import RecipeEditor from '#lib/ui/recipes/RecipeEditor.svelte';

	let { data } = $props();
</script>

<svelte:head><title>{data.recipe.name} · {m.app_name()}</title></svelte:head>

<main class="mx-auto flex max-w-[640px] flex-col gap-3 px-3.5 py-4 desk:px-7">
	<!-- A new version (after Update to current food values) starts the editor afresh. -->
	{#key data.recipe.version}
		<RecipeEditor recipe={data.recipe} stale={data.stale} />
	{/key}
</main>
