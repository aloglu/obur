<script lang="ts">
	// Archived recipes (docs/ui.md, "Archived and deleted"): opened from the row under New recipe on Recipes. A person
	// has few recipes, so the whole archive is loaded and searched here.
	import { resolve } from '$app/paths';
	import { m } from '#lib/paraglide/messages.js';
	import { api } from '#lib/client/api.ts';
	import { kcal } from '#lib/shared/format.ts';
	import { formatDecimal } from '#lib/shared/numbers.ts';
	import type { RecipeSummary } from '#lib/shared/recipe.ts';
	import { matchFood } from '#lib/shared/search-match.ts';
	import { foldForSearch } from '#lib/shared/search-text.ts';
	import PageHead from '#lib/ui/PageHead.svelte';
	import ArchiveList, { type ArchivePage } from '#lib/ui/items/ArchiveList.svelte';

	let { data } = $props();

	const page = (list: RecipeSummary[], q: string): ArchivePage => {
		// The food search rule (shared/search-match.ts); no search lists them all.
		const folded = foldForSearch(q);
		const found = folded ? list.filter((r) => matchFood(folded, foldForSearch(r.name))) : list;
		return {
			items: found.map((r) => ({
				id: r.id,
				name: r.name,
				brand: null,
				icon: r.icon,
				detail: m.recipes_row_detail({ servings: formatDecimal(r.servings, 2) }),
				kcal: r.kcal === null ? null : kcal(r.kcal)
			})),
			total: found.length,
			more: false
		};
	};
	// Read again after every change, so a restored or deleted recipe leaves the list.
	const fetchPage = async (_offset: number, q: string) =>
		page(
			(await api<{ recipes: RecipeSummary[] }>('GET', '/api/v1/recipes')).recipes.filter(
				(r) => r.archived
			),
			q
		);
</script>

<svelte:head><title>{m.archived_recipes_title()} · {m.app_name()}</title></svelte:head>

<main class="mx-auto flex max-w-[640px] flex-col gap-3 px-3.5 py-4 pb-40 desk:px-7">
	<PageHead
		href={resolve('/(app)/recipes')}
		label={m.recipes_title()}
		title={m.archived_recipes_title()}
	/>
	<ArchiveList kind="recipe" first={page(data.recipes, '')} {fetchPage} />
</main>
