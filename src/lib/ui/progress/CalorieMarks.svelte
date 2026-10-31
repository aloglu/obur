<script lang="ts">
	// The calories chart's marks inside LayerChart's frame: a bar per day or week against a budget step line. Under
	// budget is solid green, over is striped red (pattern as well as colour), a day not marked complete is an outline,
	// an unlogged one a dash. Tap, drag or use the arrow keys to select a bar.
	import { getChartContext } from 'layerchart';
	import type { CalorieBar } from '#lib/shared/history.ts';
	import { dayNumber, type AxisLabel } from './history-axis.ts';

	interface Props {
		bars: CalorieBar[];
		labels: AxisLabel[];
		weekly: boolean;
		selected: number;
		onselect: (index: number) => void;
		label: string;
		valuetext: string;
	}
	let { bars, labels, weekly, selected, onselect, label, valuetext }: Props = $props();
	const ctx = getChartContext();
	const uid = $props.id();
	const hatch = `over-${uid}`;
	const x = (i: number) => ctx.xScale(i) as number;
	const y = (v: number) => ctx.yScale(v) as number;
	const slot = $derived(ctx.width / Math.max(1, bars.length));
	const barWidth = $derived(Math.max(2, Math.min(22, slot * 0.68)));
	const budgetPath = $derived(
		bars
			.map((b, i) =>
				b.budgetKcal === null
					? ''
					: `${i > 0 && bars[i - 1].budgetKcal !== null ? 'L' : 'M'}${x(i)},${y(b.budgetKcal)}L${x(i + 1)},${y(b.budgetKcal)}`
			)
			.join('')
	);
	/** Where a date falls: its bar's index plus how far into the bar. */
	const position = (date: string) => {
		const i = bars.findIndex((b) => date >= b.from && date <= b.to);
		return i < 0 ? -1 : i + (dayNumber(date) - dayNumber(bars[i].from) + 0.5) / bars[i].days;
	};

	function pick(event: PointerEvent) {
		if (event.type === 'pointermove' && event.pointerType !== 'mouse' && !event.buttons) return;
		const box = (event.currentTarget as SVGRectElement).getBoundingClientRect();
		const px = ((event.clientX - box.left) / box.width) * ctx.width;
		onselect(Math.max(0, Math.min(bars.length - 1, Math.floor(px / slot))));
	}
	function key(event: KeyboardEvent) {
		const step = { ArrowLeft: -1, ArrowRight: 1, Home: -bars.length, End: bars.length }[event.key];
		if (step === undefined) return;
		event.preventDefault();
		onselect(Math.max(0, Math.min(bars.length - 1, selected + step)));
	}
</script>

<defs>
	<pattern
		id={hatch}
		width="5"
		height="5"
		patternUnits="userSpaceOnUse"
		patternTransform="rotate(45)"
	>
		<rect width="5" height="5" class="fill-bad" />
		<line x1="0" y1="0" x2="0" y2="5" class="stroke-surface" stroke-width="2" />
	</pattern>
</defs>
<rect
	x={selected * slot}
	y="-4"
	width={slot}
	height={ctx.height + 4}
	rx="4"
	class="fill-text"
	opacity="0.08"
/>
{#each bars as b, i (b.from)}
	{#if b.eatenKcal === null}
		{#if slot > 16}<text
				x={x(i + 0.5)}
				y={ctx.height - 3}
				text-anchor="middle"
				class="fill-muted text-[11px]">–</text
			>{/if}
	{:else}
		{@const over = b.budgetKcal !== null && b.eatenKcal > b.budgetKcal}
		{@const outline = !weekly && !b.complete}
		<rect
			x={x(i + 0.5) - barWidth / 2}
			y={y(b.eatenKcal)}
			width={barWidth}
			height={Math.max(0, ctx.height - y(b.eatenKcal))}
			rx={Math.min(3, barWidth / 3)}
			fill={outline ? 'none' : over ? `url(#${hatch})` : 'var(--good)'}
			stroke={outline ? 'var(--muted)' : 'none'}
			stroke-width="1.5"
		/>
	{/if}
{/each}
<path d={budgetPath} fill="none" class="stroke-text" stroke-width="2" />
{#each labels as l (l.date)}
	{@const at = position(l.date)}
	{#if at >= 0}
		<text
			x={x(at)}
			y={ctx.height + 16}
			text-anchor="middle"
			class="fill-muted text-[11px] tabular-nums">{l.label}</text
		>
	{/if}
{/each}
<rect
	width={ctx.width}
	height={ctx.height}
	fill="transparent"
	tabindex="0"
	role="slider"
	aria-label={label}
	aria-valuemin={0}
	aria-valuemax={Math.max(0, bars.length - 1)}
	aria-valuenow={selected}
	aria-valuetext={valuetext}
	class="cursor-crosshair touch-pan-y outline-none"
	onpointerdown={pick}
	onpointermove={pick}
	onkeydown={key}
/>
