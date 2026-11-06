<script lang="ts">
	// The weight chart's marks inside LayerChart's frame (docs/ui.md "Progress charts"). Readings: the weigh-ins as points
	// joined by a line. Trend: the smoothed weight as the line, with the weigh-ins faint behind it. Either line is dashed
	// across gaps of more than a week; the goal is a line, or a note when it is below the chart. The labels sit in their own
	// column right of the plot, and the first and last dates reach the card's edges. The line draws on from the left, then
	// the rest fades in. Tap, drag or use the arrow keys to look at a weigh-in.
	import { getChartContext } from 'layerchart';
	import { m } from '#lib/paraglide/messages.js';
	import { formatDecimal } from '#lib/shared/numbers.ts';

	interface Point {
		n: number;
		weight: number;
		trend: number;
		gapBefore: boolean;
	}
	interface Props {
		points: Point[];
		mode: 'readings' | 'trend';
		goalKg: number | null;
		/** The labels' column to the right of the plot, and the room left of it. */
		gutter: number;
		inset: number;
		firstDate: string;
		lastDate: string;
		/** The weigh-in being looked at; none at rest. */
		selected: number | null;
		onselect: (index: number) => void;
		onrelease: () => void;
		label: string;
		valuetext: string;
	}
	let {
		points,
		mode,
		goalKg,
		gutter,
		inset,
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
	const area = $derived.by(() => {
		if (points.length < 2) return '';
		const line = points.map((p, i) => `${i ? 'L' : 'M'}${x(p.n)},${y(value(p))}`).join('');
		return `${line}L${x(points.at(-1)!.n)},${ctx.height}L${x(points[0].n)},${ctx.height}Z`;
	});
	const current = $derived(selected === null ? undefined : points[selected]);
	const end = $derived(points.at(-1));
	const goalInside = $derived(goalKg !== null && goalKg >= low && goalKg <= high);
	const ticks = $derived(
		((ctx.yScale.ticks?.(4) ?? []) as number[]).filter((v) => v >= low && v <= high)
	);
	/** A label too close to the goal's gives way to it. */
	const clearOfGoal = (v: number) => !goalInside || Math.abs(y(v) - y(goalKg!)) >= 15;

	// The draw-on is a clip opening from the left, because a dash-based one can't coexist with the dashed gaps.
	let reveal = $state(0);
	const animation = $derived(`${mode}|${firstDate}|${lastDate}`);
	$effect(() => {
		void animation;
		if (matchMedia('(prefers-reduced-motion: reduce)').matches) {
			reveal = 1;
			return;
		}
		reveal = 0;
		const start = performance.now();
		let frame = requestAnimationFrame(function step(now) {
			const t = Math.min(1, (now - start) / 900);
			reveal = t < 0.5 ? 4 * t ** 3 : 1 - (2 - 2 * t) ** 3 / 2;
			if (t < 1) frame = requestAnimationFrame(step);
		});
		return () => cancelAnimationFrame(frame);
	});

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
	function lift(event: PointerEvent) {
		if (event.pointerType !== 'mouse') onrelease();
	}
	function key(event: KeyboardEvent) {
		const step = { ArrowLeft: -1, ArrowRight: 1, Home: -points.length, End: points.length }[
			event.key
		];
		if (step === undefined) return;
		event.preventDefault();
		const from = selected ?? points.length - 1;
		onselect(Math.max(0, Math.min(points.length - 1, from + step)));
	}
	const axis = 'fill-muted text-[10.5px] tabular-nums desk:text-[13.5px]';
</script>

<clipPath id="{uid}-reveal">
	<rect x={-inset - 6} y="-12" width={(ctx.width + inset + 12) * reveal} height={ctx.height + 24} />
</clipPath>

{#each ticks as v (v)}
	<line x1="0" x2={ctx.width} y1={y(v)} y2={y(v)} class="stroke-line" />
	{#if clearOfGoal(v) && y(v) < ctx.height - 6}
		<text x={ctx.width + gutter} y={y(v)} dy=".35em" text-anchor="end" class={axis}
			>{formatDecimal(v, ',', v % 1 ? 1 : 0)}</text
		>
	{/if}
{/each}
{#if goalInside}
	<line
		x1="0"
		x2={ctx.width}
		y1={y(goalKg!)}
		y2={y(goalKg!)}
		class="stroke-good"
		stroke-width="1.5"
		stroke-dasharray="4 4"
	/>
	<text
		x={ctx.width + gutter}
		y={y(goalKg!)}
		dy=".35em"
		text-anchor="end"
		class="fill-good text-[10.5px] font-semibold desk:text-[13.5px]">{m.history_goal()}</text
	>
{:else if goalKg !== null && goalKg < low && end}
	<text
		x={ctx.width}
		y="2"
		text-anchor="end"
		class="fill-good text-[10.5px] font-semibold desk:text-[13.5px]"
		>{m.history_goal_below({
			goal: formatDecimal(goalKg, ',', 1),
			distance: (value(end) - goalKg).toFixed(1).replace('.', ',')
		})}</text
	>
{/if}
<text x={-inset} y={ctx.height + 18} class={axis}>{firstDate}</text>
<text x={ctx.width + gutter} y={ctx.height + 18} text-anchor="end" class={axis}>{lastDate}</text>

{#key animation}
	<path d={area} class="after fill-soft" style:--delay="300ms" />
	{#if mode === 'trend'}
		{#each points as p (p.n)}
			<circle
				cx={x(p.n)}
				cy={y(p.weight)}
				r="2"
				class="after fill-muted"
				style:--delay="500ms"
				style:--to="0.35"
			/>
		{/each}
	{/if}
	<g clip-path="url(#{uid}-reveal)">
		<path
			d={solid}
			fill="none"
			class="stroke-accent"
			stroke-width="2.4"
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
	</g>
	{#if mode === 'readings' && points.length <= 40}
		{#each points as p (p.n)}
			<circle
				cx={x(p.n)}
				cy={y(p.weight)}
				r="2.6"
				class="after fill-accent"
				style:--delay="600ms"
			/>
		{/each}
	{/if}
	{#if end}
		<circle
			cx={x(end.n)}
			cy={y(value(end))}
			r="5"
			class="end fill-accent stroke-surface"
			stroke-width="2.5"
		/>
	{/if}
{/key}
{#if current}
	<line
		x1={x(current.n)}
		x2={x(current.n)}
		y1="0"
		y2={ctx.height}
		class="stroke-text"
		opacity="0.35"
	/>
	<circle
		cx={x(current.n)}
		cy={y(value(current))}
		r="5"
		class="fill-accent stroke-surface"
		stroke-width="2.5"
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
	aria-valuenow={selected ?? points.length - 1}
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
	.after {
		animation: fade-in 500ms ease var(--delay, 0ms) both;
	}
	.end {
		transform-box: fill-box;
		transform-origin: center;
		animation: pop-in 260ms cubic-bezier(0.2, 0.9, 0.3, 1.25) 850ms both;
	}
	@keyframes fade-in {
		from {
			opacity: 0;
		}
		to {
			opacity: var(--to, 1);
		}
	}
	@keyframes pop-in {
		from {
			transform: scale(0);
		}
	}
	@media (prefers-reduced-motion: reduce) {
		.after,
		.end {
			animation-duration: 1ms;
			animation-delay: 0ms;
		}
	}
</style>
