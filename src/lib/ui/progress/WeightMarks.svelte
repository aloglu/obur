<script lang="ts">
	// The weight chart's marks inside LayerChart's frame. Readings: the weigh-ins as points joined by a line.
	// Trend: the smoothed weight as the line, with the weigh-ins faint behind it. Either line is dashed across gaps
	// of more than a week; the goal is a line, or a note when it is below the chart. Tap, drag or use the arrow keys
	// to select a weigh-in.
	import { getChartContext } from 'layerchart';
	import { m } from '#lib/paraglide/messages.js';
	import { formatDecimal } from '#lib/shared/numbers.ts';
	import { dayNumber, type AxisLabel } from './history-axis.ts';

	interface Point {
		n: number;
		weight: number;
		trend: number;
		gapBefore: boolean;
	}
	interface Props {
		points: Point[];
		mode: 'readings' | 'trend';
		labels: AxisLabel[];
		goalKg: number | null;
		selected: number;
		onselect: (index: number) => void;
		label: string;
		valuetext: string;
	}
	let { points, mode, labels, goalKg, selected, onselect, label, valuetext }: Props = $props();
	const ctx = getChartContext();
	const x = (n: number) => ctx.xScale(n) as number;
	const y = (v: number) => ctx.yScale(v) as number;
	const [low, high] = $derived(ctx.yScale.domain() as [number, number]);
	const value = (p: Point) => (mode === 'trend' ? p.trend : p.weight);

	const solid = $derived(
		points.map((p, i) => `${i === 0 || p.gapBefore ? 'M' : 'L'}${x(p.n)},${y(value(p))}`).join('')
	);
	const dashed = $derived(
		points
			.flatMap((p, i) =>
				i > 0 && p.gapBefore
					? [`M${x(points[i - 1].n)},${y(value(points[i - 1]))}L${x(p.n)},${y(value(p))}`]
					: []
			)
			.join('')
	);
	const current = $derived(points[selected]);
	const dot = $derived(points.length > 120 ? 1.8 : 3);

	function pick(event: PointerEvent) {
		if (event.type === 'pointermove' && event.pointerType !== 'mouse' && !event.buttons) return;
		const box = (event.currentTarget as SVGRectElement).getBoundingClientRect();
		const px = ((event.clientX - box.left) / box.width) * ctx.width;
		let best = 0;
		points.forEach((p, i) => {
			if (Math.abs(x(p.n) - px) < Math.abs(x(points[best].n) - px)) best = i;
		});
		onselect(best);
	}
	function key(event: KeyboardEvent) {
		const step = { ArrowLeft: -1, ArrowRight: 1, Home: -points.length, End: points.length }[
			event.key
		];
		if (step === undefined) return;
		event.preventDefault();
		onselect(Math.max(0, Math.min(points.length - 1, selected + step)));
	}
</script>

{#each labels as l (l.date)}
	<text
		x={x(dayNumber(l.date))}
		y={ctx.height + 16}
		text-anchor="middle"
		class="fill-muted text-[11px] tabular-nums">{l.label}</text
	>
{/each}
{#if goalKg !== null && goalKg >= low && goalKg <= high}
	<line
		x1="0"
		x2={ctx.width}
		y1={y(goalKg)}
		y2={y(goalKg)}
		class="stroke-good"
		stroke-width="1.5"
		stroke-dasharray="5 4"
	/>
	<text
		x={ctx.width - 2}
		y={y(goalKg) - 5}
		text-anchor="end"
		class="fill-good text-[11px] font-semibold"
		>{m.history_goal_line({ goal: formatDecimal(goalKg, ',', 1) })}</text
	>
{:else if goalKg !== null && goalKg < low && points.length}
	<text x={ctx.width - 2} y="10" text-anchor="end" class="fill-good text-[11px] font-semibold"
		>{m.history_goal_below({
			goal: formatDecimal(goalKg, ',', 1),
			distance: (value(points.at(-1)!) - goalKg).toFixed(1).replace('.', ',')
		})}</text
	>
{/if}
{#if mode === 'trend'}
	{#each points as p (p.n)}
		<circle cx={x(p.n)} cy={y(p.weight)} r={dot} class="fill-muted" opacity="0.45" />
	{/each}
{/if}
<path
	d={solid}
	fill="none"
	class="stroke-accent"
	stroke-width={mode === 'trend' ? 2.5 : 1.75}
	stroke-linejoin="round"
	stroke-linecap="round"
/>
{#if dashed}<path
		d={dashed}
		fill="none"
		class="stroke-accent"
		stroke-width="1.75"
		stroke-dasharray="3 4"
	/>{/if}
{#if mode === 'readings'}
	{#each points as p (p.n)}
		<circle cx={x(p.n)} cy={y(p.weight)} r={dot} class="fill-accent" />
	{/each}
{/if}
{#if current}
	<line
		x1={x(current.n)}
		x2={x(current.n)}
		y1="0"
		y2={ctx.height}
		class="stroke-text"
		opacity="0.3"
	/>
	<circle
		cx={x(current.n)}
		cy={y(value(current))}
		r="5"
		class="fill-surface stroke-text"
		stroke-width="2"
	/>
{/if}
<rect
	width={ctx.width}
	height={ctx.height}
	fill="transparent"
	tabindex="0"
	role="slider"
	aria-label={label}
	aria-valuemin={0}
	aria-valuemax={Math.max(0, points.length - 1)}
	aria-valuenow={selected}
	aria-valuetext={valuetext}
	class="cursor-crosshair touch-pan-y outline-none"
	onpointerdown={pick}
	onpointermove={pick}
	onkeydown={key}
/>
