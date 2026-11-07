<script lang="ts">
	import ChevronRight from '@lucide/svelte/icons/chevron-right';
	import { goto, invalidateAll } from '$app/navigation';
	import { resolve } from '$app/paths';
	import type { ResolvedPathname } from '$app/types';
	import { m } from '#lib/paraglide/messages.js';
	import { closeInlineOnOutsideTap } from '#lib/client/inline-field.svelte.ts';
	import HistorySection from '#lib/ui/progress/HistorySection.svelte';
	import RangeSelect from '#lib/ui/progress/RangeSelect.svelte';

	let { data } = $props();
	$effect(() => closeInlineOnOutsideTap());
	const setRange = (range: string) =>
		goto(`${resolve('/(app)/progress')}?range=${range}` as ResolvedPathname, {
			replace: true,
			reset: false
		});
</script>

<svelte:head><title>{m.progress_title()} · {m.app_name()}</title></svelte:head>

<main class="mx-auto flex max-w-[920px] flex-col gap-3 px-3.5 py-4 desk:px-7">
	<div class="flex items-center justify-between gap-3">
		<h1 class="text-[24px] font-[750]">{m.progress_title()}</h1>
		<RangeSelect id="range" value={data.history.range} onchange={setRange} />
	</div>
	<HistorySection history={data.history} today={data.today} onchange={invalidateAll} />
	<a
		href={resolve('/(app)/achievements')}
		class="flex min-h-14 items-center gap-3 rounded-card bg-surface px-[18px] py-3 shadow-card"
	>
		<span class="flex-1 text-[17px] font-bold">{m.achievements_row()}</span>
		<span class="text-[14px] text-muted"
			>{m.achievements_row_count({ count: String(data.achievements) })}</span
		>
		<ChevronRight size={20} aria-hidden="true" class="text-muted" />
	</a>
</main>
