<script lang="ts">
	// The live result of an amount: kcal as the headline, then protein, carbs and fat, each with the colour of its bar
	// on the Nutrients card. Unknown is "?", never zero; bounds and estimates are marked. Carbohydrate falls back to a
	// value whose definition the source did not state (LoseIt imports), and says so.
	import { m } from '#lib/paraglide/messages.js';
	import { kcal } from '#lib/shared/format.ts';
	import type { NutrientCode, NutrientValue } from '#lib/shared/nutrients.ts';
	import { formatDecimal } from '#lib/shared/numbers.ts';
	import Roll from '../Roll.svelte';

	/** The nutrients for the chosen amount, or undefined while the amount or unit is missing. */
	let { nutrients }: { nutrients: NutrientValue[] | undefined } = $props();

	const find = (code: NutrientCode) => nutrients?.find((n) => n.code === code);
	const carbs = $derived(find('carbohydrate_excl_fibre') ?? find('carbohydrate_unspecified'));
	const carbsUnstated = $derived(
		!find('carbohydrate_excl_fibre') && !!find('carbohydrate_unspecified')
	);
	const energy = $derived(find('energy_kcal'));

	const grams = (n: NutrientValue | undefined) =>
		!n
			? m.amount_unknown_short()
			: `${n.qualifier === 'less_than' ? '< ' : n.qualifier === 'estimate' ? '≈ ' : ''}${formatDecimal(n.value, ',', 1)} g`;
	const macros = $derived([
		{ label: m.nutrient_short_protein(), color: 'var(--protein)', value: grams(find('protein')) },
		{ label: m.nutrient_short_carbohydrate(), color: 'var(--carb)', value: grams(carbs) },
		{ label: m.nutrient_short_fat(), color: 'var(--fat)', value: grams(find('fat')) }
	]);
</script>

<div class="flex flex-col gap-1.5 rounded-small bg-surface2 px-3.5 py-3" aria-live="polite">
	<!-- kcal in a fixed-width column (up to four digits) with a divider, so the macros stay put as it changes. -->
	<div class="flex items-center gap-4">
		<p
			class="flex w-[7rem] shrink-0 flex-wrap content-center items-baseline gap-1 self-stretch border-r border-line pr-3"
		>
			<span class="font-display text-[1.625rem] leading-none font-extrabold tabular-nums"
				><Roll
					value={nutrients ? (energy ? kcal(energy.value) : m.amount_unknown_short()) : '—'}
				/></span
			>
			<span class="text-[0.8125rem] font-semibold text-muted">kcal</span>
		</p>
		{#if nutrients}
			<dl class="grid min-w-0 flex-1 grid-cols-3 gap-2">
				{#each macros as macro (macro.label)}
					<div class="min-w-0">
						<dt class="flex items-center gap-1.5 text-[0.75rem] font-semibold text-muted">
							<span class="size-2 shrink-0 rounded-full" style:background={macro.color}></span>
							{macro.label}
						</dt>
						<dd class="text-[0.9375rem] font-bold tabular-nums"><Roll value={macro.value} /></dd>
					</div>
				{/each}
			</dl>
		{/if}
	</div>
	{#if nutrients && carbsUnstated}
		<p class="text-[0.75rem] text-muted">{m.amount_carbs_unstated()}</p>
	{/if}
</div>
