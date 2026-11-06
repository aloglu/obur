<script lang="ts">
	// docs/ui.md "Nutrients card". Unknown values show "+" and how many entries are unknown, never zero.
	import { m } from '#lib/paraglide/messages.js';
	import type { CarbohydrateDay } from '#lib/shared/diary-rules.ts';
	import type { DayTotals, NutrientTotal } from '#lib/shared/diary-types.ts';
	import type { MacroTargets } from '#lib/shared/goals.ts';
	import { formatDecimal } from '#lib/shared/numbers.ts';

	interface Props {
		totals: DayTotals;
		/** Carbohydrate with both definitions kept apart (imported days state no definition). */
		carbs: CarbohydrateDay;
		entryCount: number;
		/** From a calculated target; without one, bars are drawn relative to each other. */
		targets: MacroTargets | null;
	}
	let { totals, carbs, entryCount, targets }: Props = $props();

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
	/**
	 * Carbs: the excluding-fibre total when any entry states it, otherwise the imported total of unstated
	 * definition, each with a note. The two are never added together.
	 */
	const carbTotal = $derived.by((): NutrientTotal | undefined => {
		const part = carbs.stated.entries
			? carbs.stated
			: carbs.unstated.entries
				? carbs.unstated
				: null;
		if (!part) return undefined;
		return { value: part.value, unknown: entryCount - part.entries, approximate: part.approximate };
	});
	const carbNote = $derived(
		carbs.stated.entries && carbs.unstated.entries
			? m.nutrients_carbs_plus_unstated({ value: formatDecimal(carbs.unstated.value, ',', 1) })
			: !carbs.stated.entries && carbs.unstated.entries
				? m.nutrients_carbs_unstated()
				: null
	);
	const totalFor = (code: (typeof main)[number]['code']) =>
		code === 'carbohydrate_excl_fibre' ? carbTotal : totals[code];

	const largest = $derived(Math.max(1, ...main.map((n) => totalFor(n.code)?.value ?? 0)));
	const width = (n: (typeof main)[number]) => {
		const value = totalFor(n.code)?.value ?? 0;
		const goal = targets?.[n.target];
		return Math.min(100, Math.round((value / (goal || largest)) * 100));
	};
</script>

<section
	class="flex flex-col gap-3 rounded-card bg-surface px-[18px] py-4 shadow-card"
	aria-label={m.nutrients_title()}
>
	{#each main as n (n.code)}
		{@const s = shown(totalFor(n.code))}
		<div>
			<div class="grid grid-cols-[72px_minmax(0,1fr)_auto] items-center gap-2.5 text-[14px]">
				<span>{n.label()}</span>
				<div class="h-2 overflow-hidden rounded-full bg-track" aria-hidden="true">
					<div
						class="h-full rounded-full transition-[width] duration-600 ease-(--travel) motion-reduce:transition-none"
						style:background={n.color}
						style:width="{width(n)}%"
					></div>
				</div>
				<span class="min-w-[92px] text-right text-muted tabular-nums"
					><b class="font-[650] text-text">{s.text}</b>{#if targets}
						/ {targets[n.target]} g{/if}</span
				>
			</div>
			{#if s.note}<p class="mt-0.5 text-right text-[12.5px] text-muted">{s.note}</p>{/if}
			{#if n.code === 'carbohydrate_excl_fibre' && carbNote}
				<p class="mt-0.5 text-right text-[12.5px] text-muted">{carbNote}</p>
			{/if}
		</div>
	{/each}
	<dl
		class="grid grid-cols-2 gap-x-4 gap-y-1.5 border-t border-line pt-3 text-[13.5px] text-muted tabular-nums"
	>
		{#each minor as n (n.code)}
			{@const s = shown(totals[n.code])}
			<div class="flex justify-between gap-2" title={s.note ?? undefined}>
				<dt>{n.label()}</dt>
				<dd class="font-semibold text-text">{s.text}</dd>
			</div>
		{/each}
	</dl>
</section>
