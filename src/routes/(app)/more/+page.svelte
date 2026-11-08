<script lang="ts">
	import { m } from '#lib/paraglide/messages.js';
	import MoreList from '#lib/ui/shell/MoreList.svelte';

	let { data } = $props();
</script>

<svelte:head><title>{m.more_title()} · {m.app_name()}</title></svelte:head>

<main class="mx-auto flex max-w-[640px] flex-col gap-3 px-3.5 py-4 desk:px-7">
	<h1 class="text-[1.5rem] font-[750]">{m.more_title()}</h1>
	<MoreList
		isAdmin={data.user?.role === 'admin'}
		displayName={data.user?.displayName ?? ''}
		deletedCount={data.deletedCount}
		foodCount={data.foodCount}
		recipeCount={data.recipeCount}
		mealCount={data.mealCount}
		reminders={data.pushKey !== null}
	/>
</main>
