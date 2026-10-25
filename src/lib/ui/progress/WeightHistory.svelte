<script lang="ts">
	// Basic weight history: raw readings only. Missing days stay missing; the line joins actual readings, and every
	// reading is marked with a dot (docs/design.md, "Progress").
	import { m } from '#lib/paraglide/messages.js';
	import type { BodyReading } from '#lib/shared/body-types.ts';
	import { dayTitle } from '#lib/shared/format.ts';
	import { formatDecimal } from '#lib/shared/numbers.ts';

	let { readings, today }: { readings: BodyReading[]; today: string } = $props();

	const W = 320;
	const H = 120;
	const PAD = 8;
	const points = $derived.by(() => {
		if (readings.length === 0) return [];
		const start = Date.parse(`${today}T00:00:00Z`) - 89 * 86_400_000;
		const values = readings.map((r) => r.value);
		const lo = Math.min(...values) - 0.5;
		const hi = Math.max(...values) + 0.5;
		return readings.map((r) => ({
			x:
				PAD +
				((Date.parse(`${r.localDate}T00:00:00Z`) - start) / (89 * 86_400_000)) * (W - 2 * PAD),
			y: PAD + (1 - (r.value - lo) / (hi - lo)) * (H - 2 * PAD)
		}));
	});
	const recent = $derived([...readings].reverse().slice(0, 8));
</script>

<section
	class="flex flex-col gap-3 rounded-card bg-surface p-[18px] shadow-card"
	aria-labelledby="weight-history"
>
	<h2 id="weight-history" class="text-[19px] font-bold">{m.progress_weight()}</h2>
	{#if readings.length === 0}
		<p class="text-[14px] text-muted">{m.progress_weight_none()}</p>
	{:else}
		<svg
			viewBox="0 0 {W} {H}"
			class="h-auto w-full"
			role="img"
			aria-label={m.progress_weight_chart({
				first: formatDecimal(readings[0].value, ',', 1),
				last: formatDecimal(readings.at(-1)!.value, ',', 1)
			})}
		>
			<polyline
				points={points.map((p) => `${p.x},${p.y}`).join(' ')}
				fill="none"
				stroke="var(--accent)"
				stroke-width="2"
				stroke-linejoin="round"
			/>
			{#each points as p, i (i)}<circle cx={p.x} cy={p.y} r="3" fill="var(--accent)" />{/each}
		</svg>
		<h3 class="text-[12px] font-bold tracking-[0.06em] text-muted uppercase">
			{m.progress_weight_recent()}
		</h3>
		<ul class="flex flex-col divide-y divide-line">
			{#each recent as r (r.id)}
				<li class="flex min-h-11 items-center justify-between text-[15px]">
					<span>{dayTitle(r.localDate, today)}</span>
					<span class="font-semibold tabular-nums">{formatDecimal(r.value, ',', 2)} kg</span>
				</li>
			{/each}
		</ul>
	{/if}
</section>
