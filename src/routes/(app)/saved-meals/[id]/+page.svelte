<script lang="ts">
	import { resolve } from '$app/paths';
	import { m } from '#lib/paraglide/messages.js';
	import SavedMealEditor from '#lib/ui/meals/SavedMealEditor.svelte';

	let { data } = $props();
</script>

<svelte:head><title>{data.meal.name} · {m.app_name()}</title></svelte:head>

<main class="mx-auto flex max-w-[640px] flex-col gap-3 px-3.5 py-4 desk:px-7">
	<a href={resolve('/(app)/saved-meals')} class="text-[14px] font-semibold text-accent"
		>← {m.saved_title()}</a
	>
	<h1 class="text-[24px] font-[750]">{m.saved_edit_title()}</h1>
	<!-- A new revision (after Update to current food values) starts the editor afresh. -->
	{#key data.meal.revision}
		<SavedMealEditor meal={data.meal} />
	{/key}
</main>
