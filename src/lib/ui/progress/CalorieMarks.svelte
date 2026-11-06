<script lang="ts">
	// The calories chart's marks inside LayerChart's frame: a bar per day or week against a budget step line. Within budget
	// is solid green, over is striped red (pattern as well as colour), a day not marked complete an outline, an unlogged one
	// a dash. The labels sit in their own column right of the plot. The bars rise one after another. Tap, drag or use the
	// arrow keys to look at a bar.
	import { getChartContext } from 'layerchart';
	import { kcal } from '#lib/shared/format.ts';
	import type { CalorieBar } from '#lib/shared/history.ts';

	interface Props {
		bars: CalorieBar[];
		weekly: boolean;
		gutter: number;
		firstDate: string;
		lastDate: string;
		/** The bar being looked at; none at rest. */
		selected: number | null;
		onselect: (index: number) => void;
		onrelease: () => void;
		label: string;
		valuetext: string;
	}
	let {
		bars,
		weekly,
		gutter,
		firstDate,
		lastDate,
		selected,
		onselect,
		onrelease,
		label,
		valuetext
	}: Props = $props();
	const ctx = getChartContext();
	const uid = $props.id();
	const hatch = `over-${uid}`;
	const x = (i: number) => ctx.xScale(i) as number;
	const y = (v: number) => ctx.yScale(v) as number;
	const slot = $derived(ctx.width / Math.max(1, bars.length));
	const barWidth = $derived(Math.max(2, Math.min(22, slot * 0.62)));
	const budgetPath = $derived(
		bars
			.map((b, i) =>
				b.budgetKcal === null
					? ''
					: `${i > 0 && bars[i - 1].budgetKcal !== null ? 'L' : 'M'}${x(i)},${y(b.budgetKcal)}L${x(i + 1)},${y(b.budgetKcal)}`
			)
			.join('')
	);
	const ticks = $derived((ctx.yScale.ticks?.(3) ?? []) as number[]);
	const stagger = $derived(Math.min(40, 600 / Math.max(1, bars.length)));

	function pick(event: PointerEvent) {
		if (event.type === 'pointermove' && event.pointerType !== 'mouse' && !event.buttons) return;
		const box = (event.currentTarget as SVGRectElement).getBoundingClientRect();
		const px = ((event.clientX - box.left) / box.width) * ctx.width;
		onselect(Math.max(0, Math.min(bars.length - 1, Math.floor(px / slot))));
	}
	function lift(event: PointerEvent) {
		if (event.pointerType !== 'mouse') onrelease();
	}
	function key(event: KeyboardEvent) {
		const step = { ArrowLeft: -1, ArrowRight: 1, Home: -bars.length, End: bars.length }[event.key];
		if (step === undefined) return;
		event.preventDefault();
		const from = selected ?? bars.length - 1;
		onselect(Math.max(0, Math.min(bars.length - 1, from + step)));
	}
	const axis = 'fill-muted text-[10.5px] tabular-nums desk:text-[13.5px]';
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
{#each ticks as v (v)}
	<line x1="0" x2={ctx.width} y1={y(v)} y2={y(v)} class="stroke-line" />
	{#if v > 0}<text x={ctx.width + gutter} y={y(v)} dy=".35em" text-anchor="end" class={axis}
			>{kcal(v)}</text
		>{/if}
{/each}
<text x="0" y={ctx.height + 18} class={axis}>{firstDate}</text>
<text x={ctx.width + gutter} y={ctx.height + 18} text-anchor="end" class={axis}>{lastDate}</text>
{#key `${firstDate}|${lastDate}|${weekly}`}
	{#each bars as b, i (b.from)}
		{#if b.eatenKcal === null}
			<line
				x1={x(i + 0.5) - barWidth / 2}
				x2={x(i + 0.5) + barWidth / 2}
				y1={ctx.height - 1}
				y2={ctx.height - 1}
				class="stroke-muted"
				stroke-width="2"
			/>
		{:else}
			{@const over = b.budgetKcal !== null && b.eatenKcal > b.budgetKcal}
			{@const outline = !weekly && !b.complete}
			<rect
				x={x(i + 0.5) - barWidth / 2}
				y={y(b.eatenKcal)}
				width={barWidth}
				height={Math.max(0, ctx.height - y(b.eatenKcal))}
				rx={Math.min(4, barWidth / 2)}
				fill={outline ? 'none' : over ? `url(#${hatch})` : 'var(--good)'}
				stroke={outline ? 'var(--muted)' : 'none'}
				stroke-width="1.5"
				class="bar"
				style:--delay="{i * stagger}ms"
				opacity={selected === null || selected === i ? 1 : 0.45}
			/>
		{/if}
	{/each}
	<path d={budgetPath} fill="none" class="budget stroke-text" stroke-width="1.5" />
{/key}
{#if selected !== null}
	<line
		x1={x(selected + 0.5)}
		x2={x(selected + 0.5)}
		y1="0"
		y2={ctx.height}
		class="stroke-text"
		opacity="0.3"
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
	aria-valuemax={Math.max(0, bars.length - 1)}
	aria-valuenow={selected ?? bars.length - 1}
	aria-valuetext={valuetext}
	class="cursor-crosshair touch-pan-y outline-none"
	onpointerdown={pick}
	onpointermove={pick}
	onpointerup={lift}
	onpointercancel={onrelease}
	onpointerleave={onrelease}
	onblur={onrelease}
	onkeydown={key}
/>

<style>
	.bar {
		transform-box: fill-box;
		transform-origin: bottom;
		animation: rise 520ms cubic-bezier(0.25, 0.8, 0.25, 1) var(--delay) both;
	}
	.budget {
		opacity: 0.55;
		animation: budget-in 500ms ease 200ms both;
	}
	@keyframes rise {
		from {
			transform: scaleY(0);
		}
	}
	@keyframes budget-in {
		from {
			opacity: 0;
		}
	}
	@media (prefers-reduced-motion: reduce) {
		.bar,
		.budget {
			animation: none;
		}
	}
</style>
