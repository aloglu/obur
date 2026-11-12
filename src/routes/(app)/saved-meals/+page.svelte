<script lang="ts">
	// All saved meals (docs/ui.md, "Saved meals"). Each opens its editor; logging happens from Log (owner review
	// 2026-10-30: managing a meal and logging it are separate).
	import { resolve } from '$app/paths';
	import { m } from '#lib/paraglide/messages.js';
	import { kcal } from '#lib/shared/format.ts';
	import PageHead from '#lib/ui/PageHead.svelte';
	import ListCard from '#lib/ui/items/ListCard.svelte';
	import ListRow from '#lib/ui/items/ListRow.svelte';

	let { data } = $props();
</script>

<svelte:head><title>{m.saved_title()} · {m.app_name()}</title></svelte:head>

<main class="mx-auto flex max-w-[640px] flex-col gap-3 px-3.5 py-4 desk:px-7">
	<PageHead href={resolve('/(app)/more')} label={m.nav_more()} title={m.saved_title()} />
	{#if data.meals.length === 0}
		<p class="text-[0.9375rem] text-muted">{m.saved_none()}</p>
	{:else}
		<ListCard title={m.saved_list_head()} unit={m.list_kcal()}>
			{#each data.meals as s (s.id)}
				<ListRow
					href={resolve('/(app)/saved-meals/[id]', { id: s.id })}
					icon={s.firstFood?.icon ?? null}
					name={s.name}
					iconFrom={s.firstFood ?? undefined}
					detail={s.itemCount === 1
						? m.saved_row_one()
						: m.saved_row_many({ count: String(s.itemCount) })}
					kcal={`${kcal(s.kcal)}${s.partial ? '+' : ''}`}
				/>
			{/each}
		</ListCard>
	{/if}
	<a
		href={resolve('/(app)/saved-meals/new')}
		class="grid min-h-[52px] place-items-center rounded-button bg-fill px-4 text-[1.0625rem] font-[750] text-on-accent"
		>{m.saved_new()}</a
	>
</main>
