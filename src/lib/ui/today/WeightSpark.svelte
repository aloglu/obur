<script lang="ts">
	// The last seven weigh-ins, oldest first: a small line, drawn at its real width so the dots stay round. It draws on when
	// it first appears and moves to its new shape after a weigh-in (docs/ui.md, "Motion").
	import { untrack } from 'svelte';
	import { m } from '#lib/paraglide/messages.js';

	let { values }: { values: number[] } = $props();
	let width = $state(0);

	const HEIGHT = 44;
	const PAD = 6;
	type Point = [number, number];
	const target = $derived.by((): Point[] => {
		if (values.length < 2 || !width) return [];
		const low = Math.min(...values);
		const high = Math.max(...values);
		const span = Math.max(0.6, high - low);
		return values.map((v, i): Point => [
			PAD + (i * (width - 2 * PAD)) / (values.length - 1),
			PAD + ((high - v + (span - (high - low)) / 2) / span) * (HEIGHT - 2 * PAD)
		]);
	});

	let points = $state<Point[]>([]);
	let drawing = $state(false);
	const ease = (t: number) => 1 - (1 - t) ** 3;
	$effect(() => {
		const next = target;
		const from = untrack(() => points);
		if (!next.length) {
			points = [];
			return;
		}
		// Nothing to move from (or a different number of points): draw it anew.
		if (from.length !== next.length || matchMedia('(prefers-reduced-motion: reduce)').matches) {
			drawing = from.length !== next.length;
			points = next;
			return;
		}
		const start = performance.now();
		let frame = 0;
		const step = (now: number) => {
			const t = ease(Math.min(1, (now - start) / 500));
			points = next.map((p, i): Point => [
				from[i][0] + (p[0] - from[i][0]) * t,
				from[i][1] + (p[1] - from[i][1]) * t
			]);
			if (t < 1) frame = requestAnimationFrame(step);
		};
		frame = requestAnimationFrame(step);
		return () => cancelAnimationFrame(frame);
	});

	const line = $derived(
		points.map((p, i) => `${i ? 'L' : 'M'}${p[0].toFixed(1)} ${p[1].toFixed(1)}`).join(' ')
	);
	const end = $derived(points.at(-1));
</script>

<div bind:clientWidth={width} class="h-11 w-full">
	{#if end}
		<svg
			{width}
			height={HEIGHT}
			viewBox="0 0 {width} {HEIGHT}"
			role="img"
			aria-label={m.weight_spark_label()}
			class="block overflow-visible"
		>
			<path
				d="{line} L{end[0]} {HEIGHT} L{points[0][0]} {HEIGHT} Z"
				fill="var(--soft)"
				class:fade={drawing}
			/>
			<path
				d={line}
				pathLength="1"
				fill="none"
				stroke="var(--accent)"
				stroke-width="2"
				stroke-linecap="round"
				stroke-linejoin="round"
				class:draw={drawing}
			/>
			{#each points.slice(0, -1) as p, i (i)}
				<circle cx={p[0]} cy={p[1]} r="2" fill="var(--accent)" class:fade={drawing} />
			{/each}
			<circle
				cx={end[0]}
				cy={end[1]}
				r="4"
				fill="var(--accent)"
				stroke="var(--surface)"
				stroke-width="2"
				class:fade={drawing}
			/>
		</svg>
	{/if}
</div>

<style>
	.draw {
		stroke-dasharray: 1;
		animation: spark-draw 700ms var(--travel) both;
	}
	.fade {
		animation: spark-fade 400ms 400ms ease both;
	}
	@keyframes spark-draw {
		from {
			stroke-dashoffset: 1;
		}
		to {
			stroke-dashoffset: 0;
		}
	}
	@keyframes spark-fade {
		from {
			opacity: 0;
		}
	}
	@media (prefers-reduced-motion: reduce) {
		.draw,
		.fade {
			animation: none;
		}
	}
</style>
