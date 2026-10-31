<script lang="ts">
	// Weight over the range (docs/ui.md, "Progress"): LayerChart's frame and y axis, our marks, a legend and a
	// readout line for the selected weigh-in (the latest at first). Readings shows the weigh-ins; Trend the smoothed
	// weight with the weigh-ins faint behind it. The goal never stretches the scale.
	import { Axis, Chart, Svg } from 'layerchart';
	import { m } from '#lib/paraglide/messages.js';
	import { dayAndMonth } from '#lib/shared/format.ts';
	import type { WeightPoint } from '#lib/shared/history.ts';
	import { formatDecimal } from '#lib/shared/numbers.ts';
	import { axisLabels, dayNumber } from './history-axis.ts';
	import WeightMarks from './WeightMarks.svelte';

	interface Props {
		points: WeightPoint[];
		mode: 'readings' | 'trend';
		from: string;
		to: string;
		goalKg: number | null;
		height?: number;
	}
	let { points, mode, from, to, goalKg, height = 200 }: Props = $props();

	const data = $derived(points.map((p) => ({ ...p, n: dayNumber(p.date) })));
	const yDomain = $derived.by((): [number, number] => {
		const values = data.flatMap((p) => (mode === 'trend' ? [p.weight, p.trend] : [p.weight]));
		const [lo, hi] = [Math.min(...values), Math.max(...values)];
		const pad = Math.max(0.6, (hi - lo) * 0.08);
		return [lo - pad, hi + pad];
	});
	let picked = $state<number | null>(null);
	const selected = $derived(picked !== null && picked < data.length ? picked : data.length - 1);
	const current = $derived(data[selected]);
	// Weights always with one decimal ("83,0 kg"), as the person reads a scale.
	const kg = (v: number) => v.toFixed(1).replace('.', ',');
	const pace = (v: number) => `${v > 0 ? '+' : v < 0 ? '−' : '±'}${kg(Math.abs(v))}`;
	const readout = $derived.by(() => {
		if (!current) return '';
		const day = dayAndMonth(current.date);
		return mode === 'trend'
			? m.history_trend_readout({
					day,
					trend: kg(current.trend),
					pace: pace(current.pacePerWeek),
					weight: kg(current.weight)
				})
			: m.history_reading_readout({ day, weight: kg(current.weight) });
	});
	const summary = $derived.by(() => {
		if (!data.length) return '';
		const [first, last] = [data[0], data.at(-1)!];
		const ends = { firstDay: dayAndMonth(first.date), lastDay: dayAndMonth(last.date) };
		return mode === 'trend'
			? m.history_trend_summary({
					...ends,
					first: kg(first.trend),
					last: kg(last.trend),
					pace: pace(last.pacePerWeek)
				})
			: m.history_weight_summary({ ...ends, first: kg(first.weight), last: kg(last.weight) });
	});
</script>

{#if data.length === 0}
	<p class="text-[14px] text-muted">{m.history_weight_none()}</p>
{:else}
	<figure class="m-0 flex flex-col gap-2">
		<figcaption class="sr-only">{summary}</figcaption>
		<div style:height="{height}px">
			<Chart
				{data}
				x="n"
				y="weight"
				xDomain={[dayNumber(from), dayNumber(to)]}
				{yDomain}
				padding={{ left: 34, right: 8, top: 14, bottom: 22 }}
			>
				<Svg>
					<Axis
						placement="left"
						ticks={4}
						rule={false}
						format={(v: number) => formatDecimal(v, ',', v % 1 ? 1 : 0)}
						grid={{ class: 'stroke-line' }}
						tickLabelProps={{ class: 'fill-muted text-[11px] tabular-nums' }}
					/>
					<WeightMarks
						points={data}
						{mode}
						labels={axisLabels(from, to)}
						{goalKg}
						{selected}
						onselect={(i) => (picked = i)}
						label={m.progress_weight()}
						valuetext={readout}
					/>
				</Svg>
			</Chart>
		</div>
		<div class="flex flex-wrap gap-x-3.5 gap-y-1 text-[12px] text-muted" aria-hidden="true">
			{#if mode === 'trend'}
				<span class="inline-flex items-center gap-1.5"
					><i class="inline-block h-[3px] w-3.5 rounded bg-accent"
					></i>{m.history_legend_trend()}</span
				>
				<span class="inline-flex items-center gap-1.5"
					><i class="inline-block size-2 rounded-full bg-muted opacity-60"
					></i>{m.history_legend_weighins()}</span
				>
			{:else}
				<span class="inline-flex items-center gap-1.5"
					><i class="inline-block size-2 rounded-full bg-accent"
					></i>{m.history_legend_weighins()}</span
				>
			{/if}
			{#if goalKg !== null}<span class="inline-flex items-center gap-1.5"
					><i class="inline-block w-3.5 border-t-2 border-dashed border-good"
					></i>{m.history_legend_goal()}</span
				>{/if}
		</div>
		<p
			class="m-0 min-h-[2.6em] rounded-[10px] bg-surface2 px-2.5 py-2 text-[13px] tabular-nums"
			aria-live="polite"
		>
			{readout}
		</p>
	</figure>
{/if}
