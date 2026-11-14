<script lang="ts">
	// docs/ui.md "Journal": the selected day in a box of fixed size, so nothing below moves as days change. Open goes to the
	// day. A day with nothing at all says only that; one with a weigh-in keeps its columns, so the weight shows.
	import ChevronRight from '@lucide/svelte/icons/chevron-right';
	import { m } from '#lib/paraglide/messages.js';
	import { dayHref } from '#lib/client/links.ts';
	import type { CalendarDay } from '#lib/shared/calendar.ts';
	import { dayBoxTitle, kcal } from '#lib/shared/format.ts';
	import { formatDecimal } from '#lib/shared/numbers.ts';
	import Roll from '../Roll.svelte';

	interface Props {
		day: CalendarDay;
		today: string;
		/** The day's last weigh-in, if any. */
		weight: number | null;
	}
	let { day, today, weight }: Props = $props();

	const logged = $derived(day.eatenKcal > 0 || day.status !== 'unlogged');
	const empty = $derived(!logged && weight === null);
	const title = $derived(dayBoxTitle(day.date, today));
	const left = $derived((day.budgetKcal ?? 0) - day.eatenKcal);
</script>

<div
	class="mt-3 grid grid-rows-[24px_22px] gap-y-1.5 rounded-small bg-surface2 px-3.5 py-3"
	aria-live="polite"
>
	<div class="flex items-center justify-between gap-3">
		{#key title}<span class="title-in text-[0.9375rem] font-bold whitespace-nowrap">{title}</span
			>{/key}
		<a
			href={dayHref(day.date)}
			class="-mr-1 inline-flex min-h-11 items-center gap-0.5 text-[0.875rem] font-[650] text-text"
			>{m.journal_open()}<ChevronRight size={18} aria-hidden="true" class="text-accent" /></a
		>
	</div>
	{#if empty}
		<p class="grid place-items-center text-[0.875rem] leading-none font-medium text-muted">
			{m.journal_nothing_logged()}
		</p>
	{:else}
		<div
			class="grid grid-cols-[auto_minmax(0,1fr)_auto] items-baseline gap-3 text-[0.875rem] whitespace-nowrap tabular-nums"
		>
			<span class="truncate">
				{#if logged}
					<b class="font-bold"><Roll value={kcal(day.eatenKcal)} /></b>
					<small class="text-[0.8125rem] text-muted"
						>{day.budgetKcal === null
							? 'kcal'
							: m.journal_of_budget({ budget: kcal(day.budgetKcal) })}</small
					>
				{:else}
					<span class="text-muted">–</span>
				{/if}
			</span>
			<span
				class={[
					'truncate text-center font-[650] transition-colors',
					day.status === 'under' ? 'text-good' : day.status === 'over' ? 'text-bad' : 'text-muted'
				]}
			>
				{#if !logged}
					{m.journal_nothing_logged()}
				{:else if day.status === 'under'}
					{kcal(left)} {m.journal_under()}
				{:else if day.status === 'over'}
					{kcal(-left)} {m.journal_over()}
				{:else if day.status === 'incomplete'}
					{m.journal_not_complete()}
				{/if}
			</span>
			<span class="truncate text-right">
				{#if weight !== null}
					<Roll value={`${formatDecimal(weight, 2)} kg`} />
				{:else}
					<span class="text-muted">–</span>
				{/if}
			</span>
		</div>
	{/if}
</div>

<style>
	.title-in {
		animation: title-in 220ms var(--ui);
	}
	@keyframes title-in {
		from {
			opacity: 0;
			transform: translateY(5px);
		}
	}
	@media (prefers-reduced-motion: reduce) {
		.title-in {
			animation: none;
		}
	}
</style>
