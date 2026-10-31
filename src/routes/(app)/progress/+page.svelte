<script lang="ts">
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import type { ResolvedPathname } from '$app/types';
	import { m } from '#lib/paraglide/messages.js';
	import { shiftMonth } from '#lib/shared/calendar.ts';
	import CalendarMonth from '#lib/ui/progress/CalendarMonth.svelte';
	import HistorySection from '#lib/ui/progress/HistorySection.svelte';
	import RangeSelect from '#lib/ui/progress/RangeSelect.svelte';

	let { data } = $props();
	// The month and the history's range travel together in the address, so each keeps its place when the other moves.
	const href = (month: string, range: string) =>
		`${resolve('/(app)/progress')}?month=${month}&range=${range}` as ResolvedPathname;
	const setRange = (range: string) =>
		goto(href(data.month, range), { replace: true, reset: false });
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
	<CalendarMonth
		month={data.month}
		days={data.calendar}
		summary={data.summary}
		firstDayOfWeek={data.firstDayOfWeek}
		canGoNext={!data.isCurrentMonth}
		onmonth={(delta) => goto(href(shiftMonth(data.month, delta), data.history.range))}
	/>
	<HistorySection history={data.history} onrange={setRange} />
</main>
