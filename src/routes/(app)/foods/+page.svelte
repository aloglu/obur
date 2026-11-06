<script lang="ts">
	import { resolve } from '$app/paths';
	import { m } from '#lib/paraglide/messages.js';
	import { api } from '#lib/client/api.ts';
	import type { FoodSearchResult } from '#lib/shared/food-types.ts';
	import { formatDecimal } from '#lib/shared/numbers.ts';
	import FoodIcon from '#lib/ui/FoodIcon.svelte';
	import TextField from '#lib/ui/TextField.svelte';

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
			const data = await api<{ results: FoodSearchResult[] }>(
				'GET',
				`/api/v1/foods?q=${encodeURIComponent(q)}`
			);
			if (q === query.trim()) {
				results = data.results;
				searched = true;
			}
		}, 200);
	});

	const per = (r: FoodSearchResult) =>
		r.basis === 'serving'
			? (r.servingLabel ?? '')
			: r.basis === '100g'
				? m.basis_100g()
				: m.basis_100ml();
</script>

<svelte:head><title>{m.foods_title()} · {m.app_name()}</title></svelte:head>

<main class="mx-auto flex min-h-dvh max-w-[520px] flex-col gap-3 px-3.5 py-6">
	<a href={resolve('/(app)')} class="text-[14px] font-semibold text-accent">← {m.app_name()}</a>
	<div class="flex items-center justify-between gap-3">
		<h1 class="text-[24px] font-[750]">{m.foods_title()}</h1>
		<a
			href={resolve('/(app)/foods/new')}
			class="inline-flex min-h-11 items-center rounded-button bg-fill px-4 font-[750] text-on-accent"
			>{m.foods_new()}</a
		>
	</div>
	<TextField
		label={m.foods_search()}
		placeholder={m.foods_search_placeholder()}
		bind:value={query}
		type="search"
		autocomplete="off"
	/>
	{#if searched && results.length === 0}
		<p class="text-[14px] text-muted">{m.foods_none()}</p>
	{/if}
	<ul
		class="flex flex-col divide-y divide-line rounded-card bg-surface px-[18px] shadow-card empty:hidden"
	>
		{#each results as r (r.id)}
			<li>
				<a
					href={resolve('/(app)/foods/[id]', { id: r.id })}
					class="flex min-h-14 items-center gap-3 py-2"
				>
					<FoodIcon icon={r.icon} name={r.name} brand={r.brand} />
					<span class="min-w-0 flex-1">
						<span class="line-clamp-2 text-[15px] font-semibold"
							>{r.brand ? `${r.brand} ` : ''}{r.name}</span
						>
						<span class="block text-[13px] text-muted">
							{r.kcal === null
								? m.foods_kcal_unknown()
								: m.foods_per_basis({ kcal: formatDecimal(r.kcal, ',', 0), basis: per(r) })}
						</span>
					</span>
					<span
						class="shrink-0 rounded-menu bg-surface2 px-2.5 py-1 text-[12px] font-semibold text-muted"
					>
						{r.mine
							? r.visibility === 'private'
								? m.foods_private()
								: m.foods_mine()
							: m.foods_shared()}
					</span>
				</a>
			</li>
		{/each}
	</ul>
</main>
