<script lang="ts">
	// docs/ui.md, "Achievements, Journal and Help": the month's weeks, newest first, each a summary line and only the
	// moments that mattered. Highlights sit in neutral circles; achievements will join them as small badges.
	import Flag from '@lucide/svelte/icons/flag';
	import Target from '@lucide/svelte/icons/target';
	import TrendingDown from '@lucide/svelte/icons/trending-down';
	import { m } from '#lib/paraglide/messages.js';
	import { kcal, shortDate, shortWeekday } from '#lib/shared/format.ts';
	import type { JournalEvent, JournalWeek } from '#lib/shared/journal.ts';

	let { weeks, monthName }: { weeks: JournalWeek[]; monthName: string } = $props();

	const kg = (v: number) => v.toFixed(1).replace('.', ',');
	const signed = (v: number) => `${v > 0 ? '+' : v < 0 ? '−' : '±'}${kg(Math.abs(v))}`;
	const day = (date: string) => `${shortWeekday(date)} ${shortDate(date)}`;
	// "26–31 Oct", or "1 Oct" for a week of one day.
	function span(w: JournalWeek): string {
		if (w.current) return m.journal_this_week();
		if (w.from === w.to) return shortDate(w.from);
		return `${Number(w.from.slice(8))}–${shortDate(w.to)}`;
	}
	function title(e: JournalEvent): string {
		switch (e.kind) {
			case 'lowest':
				return m.journal_lowest({ kg: kg(e.kg) });
			case 'budget':
				if (e.to === null) return m.journal_budget_off();
				return e.from === null
					? m.journal_budget_set({ kcal: kcal(e.to) })
					: m.journal_budget_changed({ kcal: kcal(e.to) });
			case 'first_day':
				return m.journal_first_day();
		}
	}
	function detail(e: JournalEvent): string {
		if (e.kind === 'budget' && e.from !== null)
			return m.journal_budget_from({ day: day(e.date), kcal: kcal(e.from) });
		return day(e.date);
	}
</script>

<section class="flex min-w-0 flex-col gap-3" aria-labelledby="highlights-title">
	<h2 id="highlights-title" class="px-1 text-[19px] font-bold">
		{m.journal_highlights({ month: monthName })}
	</h2>
	{#each weeks as w (w.from)}
		<article
			class="flex flex-col gap-2.5 rounded-card bg-surface p-[18px] shadow-card"
			aria-label={span(w)}
		>
			<h3 class="text-[12px] font-bold tracking-[0.06em] text-muted uppercase">{span(w)}</h3>
			<p class="flex flex-wrap gap-x-3 gap-y-1 text-[14px] text-muted tabular-nums">
				{#if w.averageKcal !== null}
					<span
						><b class="text-text">{kcal(w.averageKcal)}</b>
						{m.journal_kcal_a_day()}</span
					>
					{#if w.averageDiff !== null}
						<span
							><b class="text-text">{kcal(Math.abs(w.averageDiff))}</b>
							{w.averageDiff > 0 ? m.journal_over() : m.journal_under()}</span
						>
					{/if}
				{:else}
					<span>{m.journal_no_complete()}</span>
				{/if}
				{#if w.weightChange !== null}
					<span><b class="text-text">{signed(w.weightChange)} kg</b></span>
				{/if}
			</p>
			{#if w.events.length}
				<ul class="flex flex-col gap-2.5">
					{#each w.events as e (e.kind + e.date)}
						<li class="flex items-center gap-3">
							<span
								class="grid size-10 shrink-0 place-items-center rounded-full bg-surface2 text-muted"
								aria-hidden="true"
							>
								{#if e.kind === 'lowest'}<TrendingDown size={20} />
								{:else if e.kind === 'budget'}<Target size={20} />
								{:else}<Flag size={20} />{/if}
							</span>
							<span class="min-w-0">
								<b class="block text-[15px] font-semibold">{title(e)}</b>
								<span class="block text-[13px] text-muted">{detail(e)}</span>
							</span>
						</li>
					{/each}
				</ul>
			{/if}
		</article>
	{:else}
		<p class="rounded-card bg-surface p-[18px] text-[15px] text-muted shadow-card">
			{m.journal_empty()}
		</p>
	{/each}
</section>
