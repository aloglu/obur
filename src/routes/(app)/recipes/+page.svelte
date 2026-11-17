<script lang="ts">
	// The person's recipes (docs/ui.md, "Recipes"). Each opens its editor; a recipe is logged from Log like any food.
	// Archived recipes have their own page, opened from the row under New recipe (docs/ui.md, "Archived and deleted").
	import { resolve } from '$app/paths';
	import { m } from '#lib/paraglide/messages.js';
	import { kcal } from '#lib/shared/format.ts';
	import { formatDecimal } from '#lib/shared/numbers.ts';
	import PageHead from '#lib/ui/PageHead.svelte';
	import ListCard from '#lib/ui/items/ListCard.svelte';
	import ListRow from '#lib/ui/items/ListRow.svelte';
	import NavRow from '#lib/ui/shell/NavRow.svelte';

	let { data } = $props();
	const inUse = $derived(data.recipes.filter((r) => !r.archived));
	const archived = $derived(data.recipes.length - inUse.length);
</script>

<svelte:head><title>{m.recipes_title()} · {m.app_name()}</title></svelte:head>

<main class="mx-auto flex max-w-[640px] flex-col gap-3 px-3.5 py-4 desk:px-7">
	<PageHead href={resolve('/(app)/more')} label={m.nav_more()} title={m.recipes_title()} />
	<a
		href={resolve('/(app)/recipes/new')}
		class="grid min-h-[52px] place-items-center rounded-button bg-fill px-4 text-[1.0625rem] font-[750] text-on-accent"
		>{m.recipes_new()}</a
	>
	{#if archived > 0}
		<div class="rounded-card bg-surface px-[18px] shadow-card">
			<NavRow
				href={resolve('/(app)/recipes/archived')}
				label={m.archived_recipes_row()}
				value={archived}
			/>
		</div>
	{/if}
	{#if inUse.length === 0}
		<p class="text-[0.9375rem] text-muted">{m.recipes_none()}</p>
	{:else}
		<ListCard title={m.recipes_list_head()} unit={m.recipes_list_unit()}>
			{#each inUse as r (r.id)}
				<ListRow
					href={resolve('/(app)/recipes/[id]', { id: r.id })}
					icon={r.icon}
					name={r.name}
					detail={m.recipes_row_detail({ servings: formatDecimal(r.servings, 2) })}
					kcal={r.kcal === null ? null : kcal(r.kcal)}
				/>
			{/each}
		</ListCard>
	{/if}
</main>
