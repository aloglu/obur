<script lang="ts">
	import { m } from '#lib/paraglide/messages.js';
	import RecipeEditor from '#lib/ui/recipes/RecipeEditor.svelte';
</script>

<svelte:head><title>{m.recipe_new_title()} · {m.app_name()}</title></svelte:head>

<main class="mx-auto flex max-w-[640px] flex-col gap-3 px-3.5 py-4 desk:px-7">
	<RecipeEditor recipe={null} />
</main>
