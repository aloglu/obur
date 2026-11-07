<script lang="ts">
	// Calories against budget over the range (docs/ui.md, "Progress charts"): LayerChart's frame with our marks, and a
	// legend. Looking at a bar reports it through `onlook`, and the headline above the chart shows it; screen readers get
	// the same as text.
	import { Chart, Svg } from 'layerchart';
	import { MediaQuery } from 'svelte/reactivity';
	import { m } from '#lib/paraglide/messages.js';
	import { dayAndMonth, kcal, shortDate } from '#lib/shared/format.ts';
	import type { CalorieBar } from '#lib/shared/history.ts';
	import CalorieMarks from './CalorieMarks.svelte';

	interface Props {
		bars: CalorieBar[];
		weekly: boolean;
		from: string;
		to: string;
		onlook: (bar: CalorieBar | null) => void;
	}
	let { bars, weekly, from, to, onlook }: Props = $props();

	const wide = new MediaQuery('min-width: 760px', false);
	const top = $derived(
		Math.max(1, ...bars.map((b) => Math.max(b.eatenKcal ?? 0, b.budgetKcal ?? 0))) * 1.08
	);
	let picked = $state<number | null>(null);
	const selected = $derived(picked !== null && picked < bars.length ? picked : null);
	function look(index: number | null) {
		picked = index;
		onlook(index === null ? null : (bars[index] ?? null));
	}

	function describe(b: CalorieBar): string {
		const when = weekly ? m.history_week({ date: shortDate(b.from) }) : dayAndMonth(b.from);
		if (b.eatenKcal === null) return m.history_bar_unlogged({ when });
		const eaten = kcal(b.eatenKcal);
		if (weekly) {
			const counts = { logged: String(b.loggedDays), days: String(b.days) };
			if (b.budgetKcal === null) return m.history_week_no_budget({ when, eaten, ...counts });
			const diff = kcal(Math.abs(b.eatenKcal - b.budgetKcal));
			const args = { when, eaten, budget: kcal(b.budgetKcal), diff, ...counts };
			return b.eatenKcal > b.budgetKcal ? m.history_week_over(args) : m.history_week_under(args);
		}
		if (b.budgetKcal === null) return m.history_bar_no_budget({ when, eaten });
		const args = {
			when,
			eaten,
			budget: kcal(b.budgetKcal),
			diff: kcal(Math.abs(b.eatenKcal - b.budgetKcal))
		};
		const text = b.eatenKcal > b.budgetKcal ? m.history_bar_over(args) : m.history_bar_under(args);
		return b.complete ? text : m.history_bar_incomplete({ text });
	}
	const current = $derived(bars[selected ?? bars.length - 1]);
	const readout = $derived(current ? describe(current) : '');
	const summary = $derived.by(() => {
		const logged = bars.filter((b) => b.eatenKcal !== null && b.budgetKcal !== null);
		const counts = {
			under: String(logged.filter((b) => b.eatenKcal! <= b.budgetKcal!).length),
			over: String(logged.filter((b) => b.eatenKcal! > b.budgetKcal!).length),
			unlogged: String(bars.filter((b) => b.eatenKcal === null).length)
		};
		return weekly
			? m.history_calories_summary_weekly(counts)
			: m.history_calories_summary_daily(counts);
	});
	const gutter = $derived(wide.current ? 42 : 30);
	const swatch = 'inline-block size-2.5 rounded-[3px]';
	const overStripes = 'repeating-linear-gradient(45deg, var(--bad) 0 3px, var(--surface) 3px 5px)';
</script>

{#if bars.some((b) => b.eatenKcal !== null)}
	<figure class="m-0 flex flex-col gap-1.5">
		<figcaption class="sr-only">{summary}</figcaption>
		<p class="sr-only" aria-live="polite">{readout}</p>
		<div class="h-[170px] desk:h-[280px]">
			<Chart
				data={bars.map((b, i) => ({ ...b, i }))}
				x="i"
				y="eatenKcal"
				xDomain={[0, bars.length]}
				yDomain={[0, top]}
				padding={{ left: 0, right: gutter, top: 8, bottom: 22 }}
			>
				<Svg>
					<CalorieMarks
						{bars}
						{weekly}
						{gutter}
						firstDate={shortDate(from)}
						lastDate={shortDate(to)}
						{selected}
						onselect={look}
						onrelease={() => look(null)}
						label={m.history_tab_calories()}
						valuetext={readout}
					/>
				</Svg>
			</Chart>
		</div>
		<div class="flex flex-wrap gap-x-3.5 gap-y-1.5 text-[0.78125rem] text-muted" aria-hidden="true">
			<span class="inline-flex items-center gap-1.5"
				><i class="{swatch} bg-good"></i>{m.history_legend_under()}</span
			>
			<span class="inline-flex items-center gap-1.5"
				><i class={swatch} style:background={overStripes}></i>{m.history_legend_over()}</span
			>
			{#if !weekly}<span class="inline-flex items-center gap-1.5"
					><i class="{swatch} border-[1.5px] border-muted"></i>{m.history_legend_incomplete()}</span
				>{/if}
		</div>
	</figure>
{/if}
