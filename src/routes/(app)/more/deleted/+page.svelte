<script lang="ts">
	// docs/ui.md "Recently deleted": entries wait here for 30 days. Restore puts one back in its meal and day.
	import { invalidateAll } from '$app/navigation';
	import { resolve } from '$app/paths';
	import ChevronLeft from '@lucide/svelte/icons/chevron-left';
	import { m } from '#lib/paraglide/messages.js';
	import { api } from '#lib/client/api.ts';
	import { showToast } from '#lib/client/toast.svelte.ts';
	import type { DiaryEntry } from '#lib/shared/diary-types.ts';
	import { dayTitle, entryName, kcal, mealName } from '#lib/shared/format.ts';
	import FoodIcon from '#lib/ui/FoodIcon.svelte';

	let { data } = $props();
	let busy = $state(false);

	async function restore(entry: DiaryEntry) {
		busy = true;
		try {
			await api('POST', `/api/v1/diary/entries/${entry.id}?action=restore`, {});
			await invalidateAll();
			showToast({
				message: m.deleted_restored({ name: entryName(entry) }),
				detail: m.toast_to({
					meal: mealName(entry.meal),
					day: dayTitle(entry.localDate, data.today)
				})
			});
		} catch {
			await invalidateAll();
			showToast({ message: m.error_generic() });
		} finally {
			busy = false;
		}
	}
</script>

<svelte:head><title>{m.deleted_title()} · {m.app_name()}</title></svelte:head>

<main class="mx-auto flex max-w-[640px] flex-col gap-3 px-3.5 py-4 desk:px-7">
	<a href={resolve('/(app)/more')} class="flex items-center gap-1 self-start font-bold text-accent">
		<ChevronLeft size={20} aria-hidden="true" />{m.nav_more()}
	</a>
	<h1 class="text-[24px] font-[750]">{m.deleted_title()}</h1>
	<div class="rounded-card bg-surface px-[18px] py-1.5 shadow-card">
		{#if data.entries.length === 0}
			<p class="py-3.5 text-[15px] text-muted">{m.deleted_empty()}</p>
		{:else}
			<ul class="flex flex-col divide-y divide-line">
				{#each data.entries as entry (entry.id)}
					<li
						class="grid min-h-14 grid-cols-[40px_minmax(0,1fr)_auto_auto] items-center gap-3 py-1.5"
					>
						<FoodIcon
							icon={entry.food?.icon}
							name={entry.kind === 'quick' ? (entry.description ?? '') : (entry.food?.name ?? '')}
							brand={entry.food?.brand}
						/>
						<span class="min-w-0">
							<span class="line-clamp-2 text-[15px] leading-[1.3] font-semibold break-words"
								>{entryName(entry)}</span
							>
							<span class="block text-[13px] text-muted"
								>{dayTitle(entry.localDate, data.today)} · {mealName(entry.meal)}</span
							>
						</span>
						<span class="text-[15px] font-[650] tabular-nums"
							>{kcal(entry.nutrients.energy_kcal?.value ?? 0)}</span
						>
						<button
							type="button"
							disabled={busy}
							onclick={() => restore(entry)}
							aria-label={m.deleted_restore_label({ name: entryName(entry) })}
							class="min-h-11 text-[14px] font-[650] text-accent disabled:opacity-50"
							>{m.deleted_restore()}</button
						>
					</li>
				{/each}
			</ul>
		{/if}
	</div>
	<p class="px-1 text-[13px] text-muted">{m.deleted_hint()}</p>
</main>
