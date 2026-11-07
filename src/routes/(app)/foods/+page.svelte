<script lang="ts">
	// Foods (docs/ui.md, "Recipes and saved meals"): the person's own foods and scans, and a search that also reaches what
	// the household shares and the curated foods. New food stays above the list: an import can bring hundreds.
	import { untrack } from 'svelte';
	import { resolve } from '$app/paths';
	import { m } from '#lib/paraglide/messages.js';
	import { api } from '#lib/client/api.ts';
	import type { FoodSearchResult } from '#lib/shared/food-types.ts';
	import { formatDecimal } from '#lib/shared/numbers.ts';
	import BackLink from '#lib/ui/BackLink.svelte';
	import Button from '#lib/ui/Button.svelte';
	import ListCard from '#lib/ui/items/ListCard.svelte';
	import ListRow from '#lib/ui/items/ListRow.svelte';
	import TextField from '#lib/ui/TextField.svelte';

	type OwnFood = FoodSearchResult & { archived: boolean };

	let { data } = $props();

	// More of the list is added to what the page loaded.
	let own = $state<OwnFood[]>(untrack(() => data.own.foods));
	let more = $state(untrack(() => data.own.more));
	let loading = $state(false);
	async function showMore() {
		loading = true;
		try {
			const page = await api<{ foods: OwnFood[]; more: boolean }>(
				'GET',
				`/api/v1/foods?mine=1&offset=${own.length}`
			);
			own.push(...page.foods);
			more = page.more;
		} finally {
			loading = false;
		}
	}

	let query = $state('');
	let results = $state<FoodSearchResult[]>([]);
	let searched = $state(false);
	let timer: ReturnType<typeof setTimeout> | undefined;

	$effect(() => {
		const q = query.trim();
		clearTimeout(timer);
		if (!q) {
			results = [];
			searched = false;
			return;
		}
		timer = setTimeout(async () => {
			const found = await api<{ results: FoodSearchResult[] }>(
				'GET',
				`/api/v1/foods?q=${encodeURIComponent(q)}`
			);
			if (q === query.trim()) {
				results = found.results;
				searched = true;
			}
		}, 200);
	});

	const per = (r: FoodSearchResult) =>
		r.basis === 'serving'
			? m.foods_per_serving({ serving: r.servingLabel ?? '' })
			: r.basis === '100g'
				? m.food_basis_100g()
				: m.food_basis_100ml();
	const who = (r: FoodSearchResult) =>
		r.visibility === 'private' ? m.food_visibility_private() : m.foods_shared();
	const energy = (r: FoodSearchResult) => (r.kcal === null ? null : formatDecimal(r.kcal, ',', 0));
</script>

<svelte:head><title>{m.foods_title()} · {m.app_name()}</title></svelte:head>

{#snippet row(r: FoodSearchResult, archived: boolean)}
	{@const line = m.foods_row_detail({ basis: per(r), who: who(r) })}
	<ListRow
		href={resolve('/(app)/foods/[id]', { id: r.id })}
		icon={r.icon}
		name={r.name}
		brand={r.brand}
		detail={archived ? `${line} · ${m.foods_archived()}` : line}
		kcal={energy(r)}
		faded={archived}
	/>
{/snippet}

<main class="mx-auto flex max-w-[640px] flex-col gap-3 px-3.5 py-4 desk:px-7">
	<BackLink href={resolve('/(app)/more')} label={m.nav_more()} />
	<h1 class="text-[24px] font-[750]">{m.foods_title()}</h1>
	<div class="pinned-search">
		<TextField
			label={m.foods_search()}
			placeholder={m.foods_search_placeholder()}
			bind:value={query}
			type="search"
			autocomplete="off"
		/>
	</div>
	<a
		href={resolve('/(app)/foods/new')}
		class="grid min-h-[52px] place-items-center rounded-button bg-fill px-4 text-[17px] font-[750] text-on-accent"
		>{m.foods_new()}</a
	>
	{#if query.trim()}
		{#if searched && results.length === 0}
			<p class="text-[14px] text-muted">{m.foods_none()}</p>
		{:else if results.length > 0}
			<ListCard title={m.foods_title()} unit={m.list_kcal()}>
				{#each results as r (r.id)}{@render row(r, false)}{/each}
			</ListCard>
		{/if}
	{:else if own.length === 0}
		<p class="text-[15px] text-muted">{m.foods_empty()}</p>
	{:else}
		<ListCard title={m.foods_list_head()} unit={m.list_kcal()}>
			{#each own as r (r.id)}{@render row(r, r.archived)}{/each}
		</ListCard>
		{#if more}
			<Button variant="ghost" disabled={loading} onclick={showMore}>{m.foods_show_more()}</Button>
		{/if}
	{/if}
</main>
