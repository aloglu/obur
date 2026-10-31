<script lang="ts">
	// Calories against budget over the range (docs/ui.md, "Progress"): LayerChart's frame and y axis, our bars and
	// budget line, a legend and a readout line for the selected day or week (the latest at first).
	import { Axis, Chart, Svg } from 'layerchart';
	import { m } from '#lib/paraglide/messages.js';
	import { dayAndMonth, kcal, shortDate } from '#lib/shared/format.ts';
	import type { CalorieBar } from '#lib/shared/history.ts';
	import { axisLabels } from './history-axis.ts';
	import CalorieMarks from './CalorieMarks.svelte';

	interface Props {
		bars: CalorieBar[];
		weekly: boolean;
		from: string;
		to: string;
		height?: number;
	}
	let { bars, weekly, from, to, height = 190 }: Props = $props();

	const top = $derived(
		Math.max(1, ...bars.map((b) => Math.max(b.eatenKcal ?? 0, b.budgetKcal ?? 0))) * 1.08
	);
	let picked = $state<number | null>(null);
	const selected = $derived(picked !== null && picked < bars.length ? picked : bars.length - 1);

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
	const readout = $derived(bars[selected] ? describe(bars[selected]) : '');
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
	const swatch = 'inline-block h-2.5 w-3.5 rounded-[3px]';
	const overStripes = 'repeating-linear-gradient(45deg, var(--bad) 0 3px, var(--surface) 3px 5px)';
</script>

{#if bars.every((b) => b.eatenKcal === null)}
	<p class="text-[14px] text-muted">{m.history_calories_none()}</p>
{:else}
	<figure class="m-0 flex flex-col gap-2">
		<figcaption class="sr-only">{summary}</figcaption>
		<div style:height="{height}px">
			<Chart
				data={bars.map((b, i) => ({ ...b, i }))}
				x="i"
				y="eatenKcal"
				xDomain={[0, bars.length]}
				yDomain={[0, top]}
				padding={{ left: 38, right: 8, top: 10, bottom: 22 }}
			>
				<Svg>
					<Axis
						placement="left"
						ticks={4}
						rule={false}
						format={(v: number) => String(Math.round(v))}
						grid={{ class: 'stroke-line' }}
						tickLabelProps={{ class: 'fill-muted text-[11px] tabular-nums' }}
					/>
					<CalorieMarks
						{bars}
						labels={axisLabels(from, to)}
						{weekly}
						{selected}
						onselect={(i) => (picked = i)}
						label={m.history_tab_calories()}
						valuetext={readout}
					/>
				</Svg>
			</Chart>
		</div>
		<div class="flex flex-wrap gap-x-3.5 gap-y-1 text-[12px] text-muted" aria-hidden="true">
			<span class="inline-flex items-center gap-1.5"
				><i class="{swatch} bg-good"></i>{m.history_legend_under()}</span
			>
			<span class="inline-flex items-center gap-1.5"
				><i class={swatch} style:background={overStripes}></i>{m.history_legend_over()}</span
			>
			{#if !weekly}<span class="inline-flex items-center gap-1.5"
					><i class="{swatch} border-[1.5px] border-muted"></i>{m.history_legend_incomplete()}</span
				>{/if}
			<span class="inline-flex items-center gap-1.5"
				><i class="inline-block h-0.5 w-3.5 bg-text"></i>{m.history_legend_budget()}</span
			>
		</div>
		<p
			class="m-0 min-h-[2.6em] rounded-[10px] bg-surface2 px-2.5 py-2 text-[13px] tabular-nums"
			aria-live="polite"
		>
			{readout}
		</p>
	</figure>
{/if}
