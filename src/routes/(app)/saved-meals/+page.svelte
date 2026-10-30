<script lang="ts">
	// All saved meals (docs/ui.md, "Saved meals"). Each opens its editor; logging happens from Log (owner review
	// 2026-10-30: managing a meal and logging it are separate).
	import { resolve } from '$app/paths';
	import Bookmark from '@lucide/svelte/icons/bookmark';
	import { m } from '#lib/paraglide/messages.js';
	import type { SavedMealSummary } from '#lib/shared/diary-types.ts';
	import { kcal } from '#lib/shared/format.ts';

	let { data } = $props();

	const summary = (s: SavedMealSummary) => {
		const total = kcal(s.kcal) + (s.partial ? '+' : '');
		return s.itemCount === 1
			? m.saved_one_item({ kcal: total })
			: m.saved_many_items({ count: String(s.itemCount), kcal: total });
	};
</script>

<svelte:head><title>{m.saved_title()} · {m.app_name()}</title></svelte:head>

<main class="mx-auto flex max-w-[640px] flex-col gap-3 px-3.5 py-4 desk:px-7">
	<div class="flex items-center justify-between gap-3">
		<h1 class="text-[24px] font-[750]">{m.saved_title()}</h1>
		<a
			href={resolve('/(app)/saved-meals/new')}
			class="inline-flex min-h-11 items-center rounded-button bg-accent px-4 font-[750] text-on-accent"
			>{m.saved_new()}</a
		>
	</div>
	{#if data.meals.length === 0}
		<p class="text-[15px] text-muted">{m.saved_none()}</p>
	{:else}
		<ul class="flex flex-col rounded-card bg-surface p-2 shadow-card">
			{#each data.meals as s (s.id)}
				<li>
					<a
						href={resolve('/(app)/saved-meals/[id]', { id: s.id })}
						class="flex min-h-14 w-full items-center gap-3 rounded-input px-2 py-2 text-left hover:bg-surface2"
					>
						<Bookmark size={18} class="shrink-0 text-accent" aria-hidden="true" />
						<span class="min-w-0 flex-1">
							<span class="line-clamp-2 text-[15px] font-semibold break-words">{s.name}</span>
							<span class="block text-[13px] text-muted">{summary(s)}</span>
						</span>
					</a>
				</li>
			{/each}
		</ul>
	{/if}
</main>
