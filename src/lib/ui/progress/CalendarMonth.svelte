<script lang="ts">
	// docs/ui.md "Progress": month grid, a ring per day filled by eaten ÷ budget; green only for complete days at or
	// under budget, a full red ring when over, neutral for logged but incomplete days, track only when nothing was
	// logged; today outlined; future days disabled. Tapping a day opens it.
	import ChevronLeft from '@lucide/svelte/icons/chevron-left';
	import ChevronRight from '@lucide/svelte/icons/chevron-right';
	import { m } from '#lib/paraglide/messages.js';
	import { dayHref } from '#lib/client/links.ts';
	import { monthWeeks, type CalendarDay, type MonthSummary } from '#lib/shared/calendar.ts';
	import { dayAndMonth, kcal, monthTitle } from '#lib/shared/format.ts';

	interface Props {
		month: string;
		days: CalendarDay[];
		summary: MonthSummary;
		firstDayOfWeek: number;
		canGoNext: boolean;
		onmonth: (delta: number) => void;
	}
	let { month, days, summary, firstDayOfWeek, canGoNext, onmonth }: Props = $props();

	const byDate = $derived(new Map(days.map((d) => [d.date, d])));
	const weeks = $derived(monthWeeks(month, firstDayOfWeek));
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

	const R = 15;
	const C = 2 * Math.PI * R;
	const colour = (d: CalendarDay) =>
		d.status === 'under' ? 'var(--good)' : d.status === 'over' ? 'var(--bad)' : 'var(--muted)';

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
</script>

{#snippet ring(d: CalendarDay)}
	<svg viewBox="0 0 36 36" class="absolute inset-0 size-full -rotate-90" aria-hidden="true">
		<circle cx="18" cy="18" r={R} fill="none" stroke="var(--track)" stroke-width="3.5" />
		{#if d.status !== 'unlogged' && d.fill > 0}
			<circle
				cx="18"
				cy="18"
				r={R}
				fill="none"
				stroke={colour(d)}
				stroke-width="3.5"
				stroke-linecap={d.status === 'over' ? 'butt' : 'round'}
				stroke-dasharray={C}
				stroke-dashoffset={C * (1 - d.fill)}
			/>
		{/if}
	</svg>
{/snippet}

<section
	class="flex flex-col gap-3 rounded-card bg-surface p-[18px] shadow-card"
	aria-labelledby="month-title"
>
	<div class="flex items-center justify-between gap-2">
		<button
			type="button"
			onclick={() => onmonth(-1)}
			aria-label={m.progress_month_previous()}
			class="grid size-11 place-items-center rounded-full bg-surface2"
			><ChevronLeft size={22} aria-hidden="true" /></button
		>
		<h2 id="month-title" class="text-[19px] font-bold">{monthTitle(month)}</h2>
		<button
			type="button"
			onclick={() => onmonth(1)}
			disabled={!canGoNext}
			aria-label={m.progress_month_next()}
			class="grid size-11 place-items-center rounded-full bg-surface2 disabled:opacity-35"
			><ChevronRight size={22} aria-hidden="true" /></button
		>
	</div>

	<table class="w-full table-fixed border-separate border-spacing-y-1.5">
		<thead>
			<tr
				>{#each headers as h (h)}<th
						scope="col"
						class="text-[12px] font-bold tracking-[0.06em] text-muted uppercase">{h}</th
					>{/each}</tr
			>
		</thead>
		<tbody>
			{#each weeks as week, i (i)}
				<tr>
					{#each week as date, j (j)}
						<td class="text-center">
							{#if date}
								{@const d = byDate.get(date)!}
								{#if d.status === 'future'}
									<span
										class="inline-grid size-10 place-items-center text-[13px] text-muted opacity-50 desk:size-[54px]"
										aria-disabled="true"
										aria-label={label(d)}>{Number(date.slice(8))}</span
									>
								{:else}
									<a
										href={dayHref(date)}
										aria-label={label(d)}
										class={[
											'relative inline-grid size-10 place-items-center rounded-full text-[13px] font-semibold tabular-nums desk:size-[54px] desk:text-[15px]',
											d.isToday && 'outline-2 outline-offset-1 outline-accent'
										]}
									>
										{@render ring(d)}
										<span class="relative">{Number(date.slice(8))}</span>
									</a>
								{/if}
							{/if}
						</td>
					{/each}
				</tr>
			{/each}
		</tbody>
	</table>

	<ul class="flex flex-wrap gap-x-4 gap-y-1.5 text-[13px] text-muted" aria-label="Key">
		<li class="flex items-center gap-1.5">
			<span class="size-3 rounded-full bg-good"></span>{m.progress_key_under()}
		</li>
		<li class="flex items-center gap-1.5">
			<span class="size-3 rounded-full bg-bad"></span>{m.progress_key_over()}
		</li>
		<li class="flex items-center gap-1.5">
			<span class="size-3 rounded-full bg-muted"></span>{m.progress_key_incomplete()}
		</li>
		<li class="flex items-center gap-1.5">
			<span class="size-3 rounded-full border-2 border-track"></span>{m.progress_key_unlogged()}
		</li>
	</ul>
	<p class="text-[15px] font-semibold">
		{m.progress_summary({
			under: String(summary.under),
			over: String(summary.over),
			incomplete: String(summary.incomplete),
			unlogged: String(summary.unlogged)
		})}
	</p>
	<p class="text-[13px] text-muted">{m.progress_summary_note()}</p>
</section>
