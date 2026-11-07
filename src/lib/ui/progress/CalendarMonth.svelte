<script lang="ts">
	// docs/ui.md "Journal": a month grid with a ring per day filled by eaten ÷ budget; green only for complete days at or
	// under budget (its ring always keeps a gap), a full red ring when over, neutral for logged but incomplete days, track
	// only when nothing was logged; today outlined; future days disabled. Tapping a day selects it: the highlight travels
	// there and the day box below follows. Away from today the month title turns into the way back.
	import ChevronLeft from '@lucide/svelte/icons/chevron-left';
	import ChevronRight from '@lucide/svelte/icons/chevron-right';
	import Undo2 from '@lucide/svelte/icons/undo-2';
	import { tick } from 'svelte';
	import { m } from '#lib/paraglide/messages.js';
	import { monthWeeks, type CalendarDay } from '#lib/shared/calendar.ts';
	import { dayAndMonth, kcal, monthTitle } from '#lib/shared/format.ts';
	import type { Snippet } from 'svelte';
	import DayRing from './DayRing.svelte';

	interface Props {
		month: string;
		days: CalendarDay[];
		firstDayOfWeek: number;
		canGoNext: boolean;
		selected: string;
		away: boolean;
		/** Which way the month just moved, for the slide. */
		direction: number;
		onselect: (date: string) => void;
		onmonth: (delta: number) => void;
		ontoday: () => void;
		children: Snippet;
	}
	let {
		month,
		days,
		firstDayOfWeek,
		canGoNext,
		selected,
		away,
		direction,
		onselect,
		onmonth,
		ontoday,
		children
	}: Props = $props();

	const byDate = $derived(new Map(days.map((d) => [d.date, d])));
	const cells = $derived(monthWeeks(month, firstDayOfWeek).flat());
	const names = [
		m.weekday_mon,
		m.weekday_tue,
		m.weekday_wed,
		m.weekday_thu,
		m.weekday_fri,
		m.weekday_sat,
		m.weekday_sun
	];
	const headers = $derived(
		Array.from({ length: 7 }, (_, i) => names[(firstDayOfWeek - 1 + i) % 7]())
	);

	function label(d: CalendarDay): string {
		const day = dayAndMonth(d.date);
		const eaten = kcal(d.eatenKcal);
		const budget = kcal(d.budgetKcal ?? 0);
		switch (d.status) {
			case 'under':
				return m.progress_day_under({
					day,
					eaten,
					budget,
					left: kcal((d.budgetKcal ?? 0) - d.eatenKcal)
				});
			case 'incomplete':
				return m.progress_day_incomplete({ day, eaten, budget });
			case 'over':
				return m.progress_day_over({
					day,
					eaten,
					budget,
					over: kcal(d.eatenKcal - (d.budgetKcal ?? 0))
				});
			case 'no_budget':
				return m.progress_day_no_budget({ day, eaten });
			case 'unlogged':
				return m.progress_day_unlogged({ day });
			default:
				return m.progress_day_future({ day });
		}
	}

	// The highlight travels to the selected day; when a new month arrives it just appears.
	let grid = $state<HTMLElement>();
	let highlight = $state<HTMLElement>();
	async function place(jump: boolean) {
		await tick();
		const cell = grid?.querySelector<HTMLElement>(`[data-date="${selected}"]`);
		if (!highlight) return;
		if (!cell) {
			highlight.style.opacity = '0';
			return;
		}
		const s = highlight.style;
		if (jump) s.transition = 'none';
		s.opacity = '1';
		s.width = `${cell.offsetWidth}px`;
		s.height = `${cell.offsetHeight}px`;
		s.transform = `translate(${cell.offsetLeft}px, ${cell.offsetTop}px)`;
		if (jump) {
			void highlight.offsetWidth;
			s.transition = '';
		}
	}
	let placedMonth = '';
	$effect(() => {
		void selected;
		const jump = placedMonth !== month;
		placedMonth = month;
		void place(jump);
	});
	$effect(() => {
		const refit = () => void place(true);
		addEventListener('resize', refit);
		return () => removeEventListener('resize', refit);
	});
</script>

<section
	class="flex flex-col rounded-card bg-surface p-[18px] shadow-card"
	aria-label={monthTitle(month)}
>
	<div class="grid grid-cols-[44px_minmax(0,1fr)_44px] items-center text-center">
		<button
			type="button"
			onclick={() => onmonth(-1)}
			aria-label={m.progress_month_previous()}
			class="grid size-11 place-items-center rounded-full"
			><ChevronLeft size={24} aria-hidden="true" /></button
		>
		<button
			type="button"
			disabled={!away}
			onclick={ontoday}
			aria-label={away ? m.journal_back_to_today({ month: monthTitle(month) }) : undefined}
			class={[
				'inline-flex min-h-11 items-center justify-center gap-1.5 justify-self-center px-2 font-display text-[1.1875rem] font-bold transition-colors',
				away ? 'text-accent' : 'text-text'
			]}
		>
			<h2>{monthTitle(month)}</h2>
			<!-- It always takes its room, so nothing shifts when it appears. -->
			<Undo2
				size={16}
				aria-hidden="true"
				class={['transition-opacity', away ? 'opacity-100' : 'w-0 opacity-0']}
			/>
		</button>
		<button
			type="button"
			onclick={() => onmonth(1)}
			disabled={!canGoNext}
			aria-label={m.progress_month_next()}
			class="grid size-11 place-items-center rounded-full disabled:text-line"
			><ChevronRight size={24} aria-hidden="true" /></button
		>
	</div>

	{#key month}
		<div
			bind:this={grid}
			class={['cal', direction !== 0 && 'slide']}
			style:--from="{direction * 14}px"
		>
			{#each headers as h (h)}
				<div class="pb-1 text-center text-[0.75rem] font-semibold text-muted">{h}</div>
			{/each}
			<span bind:this={highlight} class="highlight" aria-hidden="true"></span>
			{#each cells as date, i (i)}
				{#if !date}
					<span></span>
				{:else}
					{@const d = byDate.get(date)!}
					{#if d.status === 'future'}
						<span class="day text-muted opacity-50" aria-disabled="true" aria-label={label(d)}
							>{Number(date.slice(8))}</span
						>
					{:else}
						<button
							type="button"
							data-date={date}
							aria-label={label(d)}
							aria-pressed={date === selected}
							onclick={() => onselect(date)}
							class={['day', d.isToday && 'today']}
						>
							<span class="day-ring absolute"><DayRing status={d.status} fill={d.fill} /></span>
							<span class="relative">{Number(date.slice(8))}</span>
						</button>
					{/if}
				{/if}
			{/each}
		</div>
	{/key}
	{@render children()}
</section>

<style>
	.cal {
		position: relative;
		display: grid;
		grid-template-columns: repeat(7, minmax(0, 1fr));
		row-gap: 4px;
		margin-top: 6px;
	}
	.slide {
		animation: month-in 260ms var(--ui);
	}
	@keyframes month-in {
		from {
			opacity: 0;
			transform: translateX(var(--from));
		}
	}
	.highlight {
		position: absolute;
		top: 0;
		left: 0;
		border-radius: var(--radius-input);
		background: var(--surface2);
		transition: transform 340ms var(--travel);
		pointer-events: none;
	}
	.day {
		position: relative;
		display: grid;
		place-items: center;
		height: 46px;
		font-size: 0.8125rem;
		font-weight: 650;
		font-variant-numeric: tabular-nums;
	}
	.day-ring {
		width: 40px;
		height: 40px;
	}
	.today span {
		color: var(--accent);
	}
	.today::before {
		content: '';
		position: absolute;
		width: 44px;
		height: 44px;
		border: 2px solid var(--accent);
		border-radius: 999px;
	}
	@media (min-width: 760px) {
		.cal {
			row-gap: 6px;
		}
		.day {
			height: 68px;
			font-size: 0.9375rem;
		}
		.day-ring {
			width: 54px;
			height: 54px;
		}
		.today::before {
			width: 58px;
			height: 58px;
		}
	}
	@media (prefers-reduced-motion: reduce) {
		.slide {
			animation: none;
		}
		.highlight {
			transition: none;
		}
	}
</style>
