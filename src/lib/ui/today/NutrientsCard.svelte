<script lang="ts">
	// docs/ui.md "Nutrients card". Unknown values show "+" and how many entries are unknown, never zero.
	import { m } from '#lib/paraglide/messages.js';
	import type { DayTotals, NutrientTotal } from '#lib/shared/diary-types.ts';
	import type { MacroTargets } from '#lib/shared/goals.ts';
	import { formatDecimal } from '#lib/shared/numbers.ts';

	interface Props {
		totals: DayTotals;
		entryCount: number;
		/** From a calculated target; without one, bars are drawn relative to each other. */
		targets: MacroTargets | null;
	}
	let { totals, entryCount, targets }: Props = $props();

	const main = [
		{
			code: 'protein',
			label: m.nutrient_short_protein,
			color: 'var(--protein)',
			target: 'proteinG'
		},
		{
			code: 'carbohydrate_excl_fibre',
			label: m.nutrient_short_carbohydrate,
			color: 'var(--carb)',
			target: 'carbohydrateG'
		},
		{ code: 'fat', label: m.nutrient_short_fat, color: 'var(--fat)', target: 'fatG' }
	] as const;
	const minor = [
		{ code: 'fibre', label: m.nutrient_short_fibre },
		{ code: 'sugars', label: m.nutrient_short_sugars },
		{ code: 'saturated_fat', label: m.nutrient_short_saturated_fat },
		{ code: 'salt', label: m.nutrient_short_salt }
	] as const;

	function shown(t: NutrientTotal | undefined): { text: string; note: string | null } {
		if (!t) {
			// No entry has this nutrient: unknown, not partial (and zero only for an empty day).
			return entryCount
				? { text: '?', note: m.nutrients_all_unknown() }
				: { text: '0 g', note: null };
		}
		const plus = t.unknown > 0 || t.approximate ? '+' : '';
		return {
			text: `${formatDecimal(t.value, ',', 1)} g${plus}`,
			note: t.unknown > 0 ? m.nutrients_unknown_entries({ count: t.unknown }) : null
		};
	}
	const largest = $derived(Math.max(1, ...main.map((n) => totals[n.code]?.value ?? 0)));
	const width = (n: (typeof main)[number]) => {
		const value = totals[n.code]?.value ?? 0;
		const goal = targets?.[n.target];
		return Math.min(100, Math.round((value / (goal || largest)) * 100));
	};
</script>

<section
	class="flex flex-col gap-3 rounded-card bg-surface p-[18px] shadow-card"
	aria-labelledby="nutrients-title"
>
	<h2 id="nutrients-title" class="text-[19px] font-bold">{m.nutrients_title()}</h2>
	{#each main as n (n.code)}
		{@const s = shown(totals[n.code])}
		<div class="flex flex-col gap-1">
			<div class="flex items-baseline justify-between gap-2 text-[15px]">
				<span class="font-semibold">{n.label()}</span>
				<span class="font-semibold tabular-nums"
					>{s.text}{#if targets}<span class="font-normal text-muted">
							/ {targets[n.target]} g</span
						>{/if}</span
				>
			</div>
			<div class="h-2 overflow-hidden rounded-full bg-track" aria-hidden="true">
				<div class="h-full rounded-full" style:background={n.color} style:width="{width(n)}%"></div>
			</div>
			{#if s.note}<p class="text-[12.5px] text-muted">{s.note}</p>{/if}
		</div>
	{/each}
	<dl class="grid grid-cols-2 gap-2">
		{#each minor as n (n.code)}
			{@const s = shown(totals[n.code])}
			<div class="rounded-small bg-surface2 p-3">
				<dt class="text-[13px] text-muted">{n.label()}</dt>
				<dd class="text-[15px] font-semibold tabular-nums">{s.text}</dd>
				{#if s.note}<dd class="text-[12px] text-muted">{s.note}</dd>{/if}
			</div>
		{/each}
	</dl>
</section>
