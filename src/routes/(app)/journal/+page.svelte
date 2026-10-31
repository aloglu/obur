<script lang="ts">
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import type { ResolvedPathname } from '$app/types';
	import { m } from '#lib/paraglide/messages.js';
	import { shiftMonth } from '#lib/shared/calendar.ts';
	import { monthName } from '#lib/shared/format.ts';
	import MonthHighlights from '#lib/ui/journal/MonthHighlights.svelte';
	import CalendarMonth from '#lib/ui/progress/CalendarMonth.svelte';

	let { data } = $props();
	const href = (month: string) => `${resolve('/(app)/journal')}?month=${month}` as ResolvedPathname;
</script>

<svelte:head><title>{m.journal_title()} · {m.app_name()}</title></svelte:head>

<!-- Phone: the calendar, then the month's highlights. Desktop: side by side, the calendar staying in view. -->
<main
	class="mx-auto grid max-w-[1064px] items-start gap-3 px-3.5 py-4 desk:grid-cols-2 desk:gap-6 desk:px-7"
>
	<h1 class="text-[24px] font-[750] desk:col-span-2">{m.journal_title()}</h1>
	<div class="desk:sticky desk:top-4">
		<CalendarMonth
			month={data.month}
			days={data.calendar}
			summary={data.summary}
			firstDayOfWeek={data.firstDayOfWeek}
			canGoNext={!data.isCurrentMonth}
			onmonth={(delta) => goto(href(shiftMonth(data.month, delta)))}
		/>
	</div>
	<MonthHighlights weeks={data.weeks} monthName={monthName(data.month)} />
</main>
