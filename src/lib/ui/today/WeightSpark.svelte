<script lang="ts">
	// The last seven weigh-ins, oldest first: a small line, drawn at its real width so the dots stay round.
	import { m } from '#lib/paraglide/messages.js';

	let { values }: { values: number[] } = $props();
	let width = $state(0);

	const HEIGHT = 44;
	const PAD = 6;
	const points = $derived.by(() => {
		if (values.length < 2 || !width) return [];
		const low = Math.min(...values);
		const high = Math.max(...values);
		const span = Math.max(0.6, high - low);
		return values.map((v, i): [number, number] => [
			PAD + (i * (width - 2 * PAD)) / (values.length - 1),
			PAD + ((high - v + (span - (high - low)) / 2) / span) * (HEIGHT - 2 * PAD)
		]);
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
			<path d="{line} L{end[0]} {HEIGHT} L{points[0][0]} {HEIGHT} Z" fill="var(--soft)" />
			<path
				d={line}
				fill="none"
				stroke="var(--accent)"
				stroke-width="2"
				stroke-linecap="round"
				stroke-linejoin="round"
			/>
			{#each points.slice(0, -1) as p, i (i)}
				<circle cx={p[0]} cy={p[1]} r="2" fill="var(--accent)" />
			{/each}
			<circle
				cx={end[0]}
				cy={end[1]}
				r="4"
				fill="var(--accent)"
				stroke="var(--surface)"
				stroke-width="2"
			/>
		</svg>
	{/if}
</div>
