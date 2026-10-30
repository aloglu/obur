<script lang="ts">
	// The person's recipes (docs/ui.md, "Recipes"). Each opens its editor; a recipe is logged from Log like any food.
	import { resolve } from '$app/paths';
	import CookingPot from '@lucide/svelte/icons/cooking-pot';
	import { m } from '#lib/paraglide/messages.js';
	import { kcal } from '#lib/shared/format.ts';
	import { formatDecimal } from '#lib/shared/numbers.ts';

	let { data } = $props();
</script>

<svelte:head><title>{m.recipes_title()} · {m.app_name()}</title></svelte:head>

<main class="mx-auto flex max-w-[640px] flex-col gap-3 px-3.5 py-4 desk:px-7">
	<div class="flex items-center justify-between gap-3">
		<h1 class="text-[24px] font-[750]">{m.recipes_title()}</h1>
		<a
			href={resolve('/(app)/recipes/new')}
			class="inline-flex min-h-11 items-center rounded-button bg-accent px-4 font-[750] text-on-accent"
			>{m.recipes_new()}</a
		>
	</div>
	{#if data.recipes.length === 0}
		<p class="text-[15px] text-muted">{m.recipes_none()}</p>
	{:else}
		<ul class="flex flex-col rounded-card bg-surface p-2 shadow-card">
			{#each data.recipes as r (r.id)}
				<li>
					<a
						href={resolve('/(app)/recipes/[id]', { id: r.id })}
						class={[
							'flex min-h-14 w-full items-center gap-3 rounded-input px-2 py-2 text-left hover:bg-surface2',
							r.archived && 'opacity-60'
						]}
					>
						<CookingPot size={18} class="shrink-0 text-accent" aria-hidden="true" />
						<span class="min-w-0 flex-1">
							<span class="line-clamp-2 text-[15px] font-semibold break-words">{r.name}</span>
							<span class="block text-[13px] text-muted">
								{r.kcal === null
									? m.recipes_per_serving_unknown({ servings: formatDecimal(r.servings, ',', 2) })
									: m.recipes_per_serving({
											kcal: kcal(r.kcal),
											servings: formatDecimal(r.servings, ',', 2)
										})}
								{#if r.archived}· {m.recipes_archived()}{/if}
							</span>
						</span>
					</a>
				</li>
			{/each}
		</ul>
	{/if}
</main>
