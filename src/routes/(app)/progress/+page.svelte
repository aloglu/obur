<script lang="ts">
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import type { ResolvedPathname } from '$app/types';
	import { m } from '#lib/paraglide/messages.js';
	import { shiftMonth } from '#lib/shared/calendar.ts';
	import CalendarMonth from '#lib/ui/progress/CalendarMonth.svelte';
	import WeightHistory from '#lib/ui/progress/WeightHistory.svelte';

	let { data } = $props();
	const monthHref = (month: string) =>
		`${resolve('/(app)/progress')}?month=${month}` as ResolvedPathname;
</script>

<svelte:head><title>{m.progress_title()} · {m.app_name()}</title></svelte:head>

<main
	class="mx-auto grid max-w-[1064px] gap-3 px-3.5 py-4 desk:grid-cols-[minmax(0,1fr)_380px] desk:gap-6 desk:px-7"
>
	<h1 class="text-[24px] font-[750] desk:col-span-2">{m.progress_title()}</h1>
	<CalendarMonth
		month={data.month}
		days={data.calendar}
		summary={data.summary}
		firstDayOfWeek={data.firstDayOfWeek}
		canGoNext={!data.isCurrentMonth}
		onmonth={(delta) => goto(monthHref(shiftMonth(data.month, delta)))}
	/>
	<WeightHistory readings={data.weights} today={data.today} />
</main>
