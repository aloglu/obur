<script lang="ts">
	// Weight over the range (docs/ui.md, "Progress charts"): LayerChart's frame with our marks. Readings shows the weigh-ins;
	// Trend the smoothed weight with the weigh-ins faint behind it. The goal never stretches the scale. Looking at a
	// weigh-in reports it through `onlook`, and the headline above the chart shows it; screen readers get the same as text.
	import { Chart, Svg } from 'layerchart';
	import { MediaQuery } from 'svelte/reactivity';
	import { m } from '#lib/paraglide/messages.js';
	import { dayAndMonth, shortDate } from '#lib/shared/format.ts';
	import type { WeightPoint } from '#lib/shared/history.ts';
	import { dayNumber } from './history-axis.ts';
	import WeightMarks from './WeightMarks.svelte';

	interface Props {
		points: WeightPoint[];
		mode: 'readings' | 'trend';
		from: string;
		to: string;
		goalKg: number | null;
		onlook: (point: WeightPoint | null) => void;
	}
	let { points, mode, from, to, goalKg, onlook }: Props = $props();

	const wide = new MediaQuery('min-width: 760px', false);
	const data = $derived(points.map((p) => ({ ...p, n: dayNumber(p.date) })));
	const yDomain = $derived.by((): [number, number] => {
		const values = data.flatMap((p) => (mode === 'trend' ? [p.weight, p.trend] : [p.weight]));
		const [lo, hi] = [Math.min(...values), Math.max(...values)];
		const pad = Math.max(0.6, (hi - lo) * 0.08);
		return [lo - pad, hi + pad];
	});
	let picked = $state<number | null>(null);
	const selected = $derived(picked !== null && picked < data.length ? picked : null);
	const current = $derived(data[selected ?? data.length - 1]);
	function look(index: number | null) {
		picked = index;
		onlook(index === null ? null : (points[index] ?? null));
	}
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
	const inset = 6;
	const gutter = $derived(wide.current ? 42 : 30);
</script>

{#if data.length === 0}
	<p class="text-[14px] text-muted">{m.history_weight_none()}</p>
{:else}
	<figure class="m-0">
		<figcaption class="sr-only">{summary}</figcaption>
		<p class="sr-only" aria-live="polite">{readout}</p>
		<div class="h-[170px] desk:h-[280px]">
			<Chart
				{data}
				x="n"
				y="weight"
				xDomain={[dayNumber(from), dayNumber(to)]}
				{yDomain}
				padding={{ left: inset, right: gutter, top: 8, bottom: 22 }}
			>
				<Svg>
					<WeightMarks
						points={data}
						{mode}
						{goalKg}
						{gutter}
						{inset}
						firstDate={shortDate(from)}
						lastDate={shortDate(to)}
						{selected}
						onselect={look}
						onrelease={() => look(null)}
						label={m.progress_weight()}
						valuetext={readout}
					/>
				</Svg>
			</Chart>
		</div>
	</figure>
{/if}
