<script lang="ts">
	// Archived foods (docs/ui.md, "Archived and deleted"): opened from the row under New food on Foods.
	import { resolve } from '$app/paths';
	import { m } from '#lib/paraglide/messages.js';
	import { api } from '#lib/client/api.ts';
	import { foodName, servingLabelName } from '#lib/shared/curated-names.ts';
	import type { FoodSearchResult } from '#lib/shared/food-types.ts';
	import { formatDecimal } from '#lib/shared/numbers.ts';
	import PageHead from '#lib/ui/PageHead.svelte';
	import ArchiveList, { type ArchivePage } from '#lib/ui/items/ArchiveList.svelte';

	let { data } = $props();

	const per = (r: FoodSearchResult) =>
		r.basis === 'serving'
			? m.foods_per_serving({ serving: servingLabelName(r.servingLabel ?? '') })
			: r.basis === '100g'
				? m.food_basis_100g()
				: m.food_basis_100ml();
	const page = (p: { foods: FoodSearchResult[]; total: number; more: boolean }): ArchivePage => ({
		items: p.foods.map((f) => ({
			id: f.id,
			name: foodName(f.name, f.curated),
			brand: f.brand,
			icon: f.icon,
			detail: per(f),
			kcal: f.kcal === null ? null : formatDecimal(f.kcal, 0)
		})),
		total: p.total,
		more: p.more
	});
	const fetchPage = async (offset: number, q: string) =>
		page(
			await api(
				'GET',
				`/api/v1/foods?mine=1&archived=1&offset=${offset}&q=${encodeURIComponent(q)}`
			)
		);
</script>

<svelte:head><title>{m.archived_foods_title()} · {m.app_name()}</title></svelte:head>

<main class="mx-auto flex max-w-[640px] flex-col gap-3 px-3.5 py-4 pb-40 desk:px-7">
	<PageHead
		href={resolve('/(app)/foods')}
		label={m.foods_title()}
		title={m.archived_foods_title()}
	/>
	<ArchiveList kind="food" first={page(data.archive)} {fetchPage} />
</main>
