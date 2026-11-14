<script lang="ts">
	import { fixedDecimal } from '#lib/shared/numbers.ts';
	// docs/ui.md, "Achievements, Journal and Help": the month's weeks, newest first, each a summary line and only the
	// moments that mattered. Achievements show as small versions of their badges and open the badge page; other
	// highlights sit in neutral circles.
	import Flag from '@lucide/svelte/icons/flag';
	import Target from '@lucide/svelte/icons/target';
	import TrendingDown from '@lucide/svelte/icons/trending-down';
	import { resolve } from '$app/paths';
	import { m } from '#lib/paraglide/messages.js';
	import { kcal, shortDate, shortDay } from '#lib/shared/format.ts';
	import type { JournalEvent, JournalWeek } from '#lib/shared/journal.ts';
	import Badge from '../achievements/Badge.svelte';
	import { achievementTitle, comparison } from '../achievements/text.ts';

	let { weeks, monthName, current }: { weeks: JournalWeek[]; monthName: string; current: boolean } =
		$props();

	const kg = (v: number) => fixedDecimal(v, 1);
	const signed = (v: number) => `${v > 0 ? '+' : v < 0 ? '−' : '±'}${kg(Math.abs(v))}`;
	const day = (date: string) => shortDay(date);
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
			case 'achievement':
				return achievementTitle(e.achievement);
		}
	}
	function detail(e: JournalEvent): string {
		if (e.kind === 'budget' && e.from !== null)
			return m.journal_budget_from({ day: day(e.date), kcal: kcal(e.from) });
		if (e.kind === 'achievement' && e.achievement.kind === 'weight') {
			const what = comparison(e.achievement.level);
			if (what) return `${day(e.date)} · ${what}`;
		}
		return day(e.date);
	}
</script>

{#snippet words(e: JournalEvent)}
	<span class="min-w-0">
		<b class="block text-[0.875rem] font-semibold">{title(e)}</b>
		<span class="block text-[0.8125rem] text-muted">{detail(e)}</span>
	</span>
{/snippet}

<section
	class="rounded-card bg-surface px-[18px] py-2 shadow-card"
	aria-labelledby="highlights-title"
>
	<h2 id="highlights-title" class="pt-2.5 text-[1.1875rem] font-bold">
		{m.journal_highlights({ month: monthName })}
	</h2>
	{#each weeks as w (w.from)}
		<article class="py-[18px] not-last:border-b not-last:border-line" aria-label={span(w)}>
			<div class="flex items-baseline justify-between gap-3">
				<h3 class="text-[0.9375rem] font-bold">{span(w)}</h3>
				{#if w.weightChange !== null}
					<span
						class={[
							'text-[0.875rem] font-[650] whitespace-nowrap tabular-nums',
							w.weightChange < 0 ? 'text-good' : 'text-muted'
						]}>{signed(w.weightChange)} kg</span
					>
				{/if}
			</div>
			<p class="mt-[3px] text-[0.84375rem] text-muted tabular-nums">
				{#if w.averageKcal !== null}
					{kcal(w.averageKcal)}
					{m.journal_kcal_a_day()}{#if w.averageDiff !== null}
						· {kcal(Math.abs(w.averageDiff))}
						{w.averageDiff > 0 ? m.journal_over() : m.journal_under()}{/if}
				{:else}
					{m.journal_no_complete()}
				{/if}
			</p>
			{#if w.events.length}
				<ul class="mt-3 flex flex-col gap-2">
					{#each w.events as e (e.kind === 'achievement' ? `${e.achievement.kind}:${e.achievement.level}` : `${e.kind}:${e.date}`)}
						<li>
							{#if e.kind === 'achievement'}
								<a href={resolve('/(app)/achievements')} class="flex items-center gap-2.5">
									<Badge achievement={e.achievement} size="sm" />
									{@render words(e)}
								</a>
							{:else}
								<div class="flex items-center gap-2.5">
									<span
										class="grid size-10 shrink-0 place-items-center rounded-full bg-surface2 text-muted"
										aria-hidden="true"
									>
										{#if e.kind === 'lowest'}<TrendingDown size={18} />
										{:else if e.kind === 'budget'}<Target size={18} />
										{:else}<Flag size={18} />{/if}
									</span>
									{@render words(e)}
								</div>
							{/if}
						</li>
					{/each}
				</ul>
			{/if}
		</article>
	{:else}
		<p class="py-3.5 text-[0.9375rem] text-muted">
			{current ? m.journal_empty_current() : m.journal_empty()}
		</p>
	{/each}
</section>
