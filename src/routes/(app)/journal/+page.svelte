<script lang="ts">
	// docs/ui.md "Journal": one column on every screen. The calendar and the selected day, then the month's highlights.
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import type { ResolvedPathname } from '$app/types';
	import { m } from '#lib/paraglide/messages.js';
	import { shiftMonth } from '#lib/shared/calendar.ts';
	import { monthName } from '#lib/shared/format.ts';
	import DayBox from '#lib/ui/journal/DayBox.svelte';
	import MonthHighlights from '#lib/ui/journal/MonthHighlights.svelte';
	import CalendarMonth from '#lib/ui/progress/CalendarMonth.svelte';

	let { data } = $props();
	const href = (month: string) => `${resolve('/(app)/journal')}?month=${month}` as ResolvedPathname;

	// Follows the page's day when a month loads; a tap overrides it until then.
	let selected = $derived(data.selectedDay);
	let direction = $state(0);
	const day = $derived(data.calendar.find((d) => d.date === selected));
	const away = $derived(selected !== data.today);

	function changeMonth(delta: number) {
		direction = delta;
		void goto(href(shiftMonth(data.month, delta)), { reset: false });
	}
	function backToToday() {
		direction = data.isCurrentMonth ? 0 : 1;
		if (data.isCurrentMonth) selected = data.today;
		else void goto(resolve('/(app)/journal'), { reset: false });
	}
</script>

<svelte:head><title>{m.journal_title()} · {m.app_name()}</title></svelte:head>

<main class="mx-auto flex max-w-[760px] flex-col gap-3 px-3.5 py-4 desk:px-7">
	<h1 class="text-[1.5rem] font-[750]">{m.journal_title()}</h1>
	<CalendarMonth
		month={data.month}
		days={data.calendar}
		firstDayOfWeek={data.firstDayOfWeek}
		canGoNext={!data.isCurrentMonth}
		{selected}
		{away}
		{direction}
		onselect={(date) => (selected = date)}
		onmonth={changeMonth}
		ontoday={backToToday}
	>
		{#if day}<DayBox {day} today={data.today} weight={data.dayWeights[day.date] ?? null} />{/if}
	</CalendarMonth>
	<MonthHighlights
		weeks={data.weeks}
		monthName={monthName(data.month)}
		current={data.isCurrentMonth}
	/>
</main>
