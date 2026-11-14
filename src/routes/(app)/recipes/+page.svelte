<script lang="ts">
	// The person's recipes (docs/ui.md, "Recipes"). Each opens its editor; a recipe is logged from Log like any food.
	import { resolve } from '$app/paths';
	import { m } from '#lib/paraglide/messages.js';
	import { kcal } from '#lib/shared/format.ts';
	import { formatDecimal } from '#lib/shared/numbers.ts';
	import PageHead from '#lib/ui/PageHead.svelte';
	import ListCard from '#lib/ui/items/ListCard.svelte';
	import ListRow from '#lib/ui/items/ListRow.svelte';

	let { data } = $props();
</script>

<svelte:head><title>{m.recipes_title()} · {m.app_name()}</title></svelte:head>

<main class="mx-auto flex max-w-[640px] flex-col gap-3 px-3.5 py-4 desk:px-7">
	<PageHead href={resolve('/(app)/more')} label={m.nav_more()} title={m.recipes_title()} />
	{#if data.recipes.length === 0}
		<p class="text-[0.9375rem] text-muted">{m.recipes_none()}</p>
	{:else}
		<ListCard title={m.recipes_list_head()} unit={m.recipes_list_unit()}>
			{#each data.recipes as r (r.id)}
				{@const who = r.visibility === 'shared' ? m.foods_shared() : m.food_visibility_private()}
				{@const line = m.recipes_row_detail({ servings: formatDecimal(r.servings, 2), who })}
				<ListRow
					href={resolve('/(app)/recipes/[id]', { id: r.id })}
					icon={r.icon}
					name={r.name}
					detail={r.archived ? `${line} · ${m.recipes_archived()}` : line}
					kcal={r.kcal === null ? null : kcal(r.kcal)}
					faded={r.archived}
				/>
			{/each}
		</ListCard>
	{/if}
	<a
		href={resolve('/(app)/recipes/new')}
		class="grid min-h-[52px] place-items-center rounded-button bg-fill px-4 text-[1.0625rem] font-[750] text-on-accent"
		>{m.recipes_new()}</a
	>
</main>
