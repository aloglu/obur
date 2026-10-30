<script lang="ts">
	import { resolve } from '$app/paths';
	import { m } from '#lib/paraglide/messages.js';
	import RecipeEditor from '#lib/ui/recipes/RecipeEditor.svelte';

	let { data } = $props();
</script>

<svelte:head><title>{data.recipe.name} · {m.app_name()}</title></svelte:head>

<main class="mx-auto flex max-w-[640px] flex-col gap-3 px-3.5 py-4 desk:px-7">
	<a href={resolve('/(app)/recipes')} class="text-[14px] font-semibold text-accent"
		>← {m.recipes_title()}</a
	>
	<h1 class="text-[24px] font-[750]">{m.recipe_edit_title()}</h1>
	{#if data.recipe.archived}<p class="text-[14px] text-muted">{m.food_archived()}</p>{/if}
	<!-- A new version (after Update to current food values) starts the editor afresh. -->
	{#key data.recipe.version}
		<RecipeEditor recipe={data.recipe} />
	{/key}
</main>
