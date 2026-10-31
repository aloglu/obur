<script lang="ts">
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import type { ResolvedPathname } from '$app/types';
	import { m } from '#lib/paraglide/messages.js';
	import HistorySection from '#lib/ui/progress/HistorySection.svelte';
	import RangeSelect from '#lib/ui/progress/RangeSelect.svelte';

	let { data } = $props();
	const setRange = (range: string) =>
		goto(`${resolve('/(app)/progress')}?range=${range}` as ResolvedPathname, {
			replace: true,
			reset: false
		});
</script>

<svelte:head><title>{m.progress_title()} · {m.app_name()}</title></svelte:head>

<main
	class="mx-auto grid max-w-[1064px] items-start gap-3 px-3.5 py-4 desk:grid-cols-2 desk:gap-6 desk:px-7"
>
	<div class="flex items-center justify-between gap-3 desk:col-span-2">
		<h1 class="text-[24px] font-[750]">{m.progress_title()}</h1>
		<div class="hidden desk:block">
			<RangeSelect id="range-desktop" value={data.history.range} onchange={setRange} />
		</div>
	</div>
	<HistorySection history={data.history} onrange={setRange} />
</main>
