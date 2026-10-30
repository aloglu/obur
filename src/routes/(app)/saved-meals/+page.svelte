<script lang="ts">
	// All saved meals (docs/ui.md, "Saved meals"); each opens the same sheet as in Log, to log or manage it.
	import { goto, invalidateAll } from '$app/navigation';
	import Bookmark from '@lucide/svelte/icons/bookmark';
	import { m } from '#lib/paraglide/messages.js';
	import { dayHref } from '#lib/client/links.ts';
	import { deviceZone } from '#lib/client/prefs.ts';
	import { showLoggedMeal } from '#lib/client/saved-meal-toast.ts';
	import { showToast } from '#lib/client/toast.svelte.ts';
	import { defaultMeal } from '#lib/shared/diary-rules.ts';
	import type { SavedMealSummary } from '#lib/shared/diary-types.ts';
	import { kcal } from '#lib/shared/format.ts';
	import SavedMealSheet from '#lib/ui/log/SavedMealSheet.svelte';

	let { data } = $props();
	let open = $state<string | null>(null);

	const summary = (s: SavedMealSummary) => {
		const total = kcal(s.kcal) + (s.partial ? '+' : '');
		return s.itemCount === 1
			? m.saved_one_item({ kcal: total })
			: m.saved_many_items({ count: String(s.itemCount), kcal: total });
	};
</script>

<svelte:head><title>{m.saved_title()} · {m.app_name()}</title></svelte:head>

<main class="mx-auto flex max-w-[640px] flex-col gap-3 px-3.5 py-4 desk:px-7">
	<h1 class="text-[24px] font-[750]">{m.saved_title()}</h1>
	{#if data.meals.length === 0}
		<p class="text-[15px] text-muted">{m.saved_none()}</p>
	{:else}
		<ul class="flex flex-col rounded-card bg-surface p-2 shadow-card">
			{#each data.meals as s (s.id)}
				<li>
					<button
						type="button"
						onclick={() => (open = s.id)}
						class="flex min-h-14 w-full items-center gap-3 rounded-input px-2 py-2 text-left hover:bg-surface2"
					>
						<Bookmark size={18} class="shrink-0 text-accent" aria-hidden="true" />
						<span class="min-w-0 flex-1">
							<span class="line-clamp-2 text-[15px] font-semibold break-words">{s.name}</span>
							<span class="block text-[13px] text-muted">{summary(s)}</span>
						</span>
					</button>
				</li>
			{/each}
		</ul>
	{/if}
</main>

{#if open}
	<SavedMealSheet
		savedMealId={open}
		date={data.today}
		today={data.today}
		meal={defaultMeal(new Date(), deviceZone())}
		onlogged={async (entries) => {
			open = null;
			await goto(dayHref(entries[0].localDate, entries[0].id));
			showLoggedMeal(entries, () => goto(dayHref(entries[0].localDate), { invalidateAll: true }));
		}}
		onchanged={invalidateAll}
		ondeleted={async (name) => {
			open = null;
			await invalidateAll();
			showToast({ message: m.saved_deleted({ name }) });
		}}
		onclose={() => (open = null)}
	/>
{/if}
