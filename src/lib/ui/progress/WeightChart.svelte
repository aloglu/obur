<script lang="ts">
	// Weight over the range (docs/ui.md, "Progress"): LayerChart's frame and y axis, our marks, a legend and a
	// readout line for the selected weigh-in (the latest at first). The goal never stretches the scale.
	import { Axis, Chart, Svg } from 'layerchart';
	import { m } from '#lib/paraglide/messages.js';
	import { dayAndMonth } from '#lib/shared/format.ts';
	import type { TrendPoint } from '#lib/shared/history.ts';
	import { formatDecimal } from '#lib/shared/numbers.ts';
	import { axisLabels, dayNumber } from './history-axis.ts';
	import WeightMarks from './WeightMarks.svelte';

	interface Props {
		points: TrendPoint[];
		from: string;
		to: string;
		goalKg: number | null;
		height?: number;
	}
	let { points, from, to, goalKg, height = 200 }: Props = $props();

	const data = $derived(points.map((p) => ({ ...p, n: dayNumber(p.date) })));
	const yDomain = $derived.by((): [number, number] => {
		const values = data.flatMap((p) => [p.weight, p.trend]);
		const [lo, hi] = [Math.min(...values), Math.max(...values)];
		const pad = Math.max(0.6, (hi - lo) * 0.08);
		return [lo - pad, hi + pad];
	});
	let picked = $state<number | null>(null);
	const selected = $derived(picked !== null && picked < data.length ? picked : data.length - 1);
	const current = $derived(data[selected]);
	const kg = (v: number) => v.toFixed(1).replace('.', ',');
	const readout = $derived.by(() => {
		if (!current) return '';
		const diff = current.weight - current.trend;
		const base = {
			day: dayAndMonth(current.date),
			weight: kg(current.weight),
			trend: kg(current.trend)
		};
		return Math.abs(diff) >= 1
			? m.history_weight_readout_off({
					...base,
					diff: `${diff > 0 ? '+' : '−'}${kg(Math.abs(diff))}`
				})
			: m.history_weight_readout(base);
	});
	const summary = $derived(
		data.length
			? m.history_weight_summary({
					first: kg(data[0].weight),
					firstDay: dayAndMonth(data[0].date),
					last: kg(data.at(-1)!.weight),
					lastDay: dayAndMonth(data.at(-1)!.date),
					trend: kg(data.at(-1)!.trend)
				})
			: ''
	);
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
				y="trend"
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
						labels={axisLabels(from, to)}
						{goalKg}
						{selected}
						onselect={(i) => (picked = i)}
						label={m.progress_weight()}
					/>
				</Svg>
			</Chart>
		</div>
		<div class="flex flex-wrap gap-x-3.5 gap-y-1 text-[12px] text-muted" aria-hidden="true">
			<span class="inline-flex items-center gap-1.5"
				><i class="inline-block h-[3px] w-3.5 rounded bg-accent"
				></i>{m.history_legend_trend()}</span
			>
			<span class="inline-flex items-center gap-1.5"
				><i class="inline-block size-2 rounded-full bg-muted opacity-60"
				></i>{m.history_legend_weighins()}</span
			>
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
