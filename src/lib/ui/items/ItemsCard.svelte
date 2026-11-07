<script lang="ts">
	// The food list of the saved meal and recipe editors: each item a row (name, quantity, kcal) that opens to its
	// amount, unit, macros and Remove. Icons and Add food share one column. Nothing is saved here.
	import AmountField from '../AmountField.svelte';
	import Plus from '@lucide/svelte/icons/plus';
	import { onMount } from 'svelte';
	import { api } from '#lib/client/api.ts';
	import { m } from '#lib/paraglide/messages.js';
	import type { FoodDetail, FoodSearchResult } from '#lib/shared/food-types.ts';
	import { kcal } from '#lib/shared/format.ts';
	import { formatDecimal } from '#lib/shared/numbers.ts';
	import type { MeasureOption, UnitOption } from '#lib/shared/unit-options.ts';
	import FoodIcon from '../FoodIcon.svelte';
	import Roll from '../Roll.svelte';
	import AddFoodSheet from './AddFoodSheet.svelte';
	import { asValues, newDraft, nutrientsOf, optionsFor, quantityOf, type Draft } from './drafts.ts';

	interface Props {
		title: string;
		items: Draft[];
		measures: MeasureOption[];
		emptyText: string;
		showErrors: boolean;
		removeLabel: string;
		/** Recipes can't contain recipes (yet). */
		allowRecipes?: boolean;
	}
	let {
		title,
		items = $bindable(),
		measures,
		emptyText,
		showErrors,
		removeLabel,
		allowRecipes = true
	}: Props = $props();

	let open = $state<string | null>(null);
	let adding = $state(false);
	let recent = $state<FoodSearchResult[]>([]);
	onMount(() => {
		void api<{ results: FoodSearchResult[] }>('GET', '/api/v1/diary/recent')
			.then((data) => (recent = data.results))
			.catch(() => {}); // Offline without a saved copy: the search is still there.
	});

	const computed = $derived(items.map((d) => nutrientsOf(d, measures)));
	const total = $derived(computed.reduce((sum, n) => sum + (n?.energy_kcal?.value ?? 0), 0));
	const partial = $derived(computed.some((n) => !n?.energy_kcal));

	function add(food: FoodDetail, amount: number, option: UnitOption) {
		items.push(newDraft(food, amount, option));
		adding = false;
	}

	function macros(values: ReturnType<typeof asValues>) {
		const find = (code: string) => values?.find((n) => n.code === code);
		const grams = (n: ReturnType<typeof find>) =>
			n ? `${formatDecimal(n.value, ',', 1)} g` : m.amount_unknown_short();
		return [
			{ color: 'var(--protein)', label: m.nutrient_short_protein(), value: grams(find('protein')) },
			{
				color: 'var(--carb)',
				label: m.nutrient_short_carbohydrate(),
				value: grams(find('carbohydrate_excl_fibre') ?? find('carbohydrate_unspecified'))
			},
			{ color: 'var(--fat)', label: m.nutrient_short_fat(), value: grams(find('fat')) }
		];
	}

	function remove(key: string) {
		items = items.filter((d) => d.key !== key);
		open = null;
	}
</script>

<section
	class="flex flex-col rounded-card bg-surface px-[18px] pt-1.5 pb-2 shadow-card"
	aria-labelledby="items-title"
>
	<div class="flex min-h-11 items-center justify-between gap-3">
		<h2 id="items-title" class="text-[1.1875rem] font-bold">{title}</h2>
		<span class="text-[0.9375rem] font-bold tabular-nums"
			><Roll value={`${kcal(total)}${partial ? '+' : ''}`} /></span
		>
	</div>
	{#if items.length === 0}
		<p class={['pb-2 text-[0.875rem]', showErrors ? 'font-semibold text-bad' : 'text-muted']}>
			{emptyText}
		</p>
	{/if}
	<ul class="-mx-2.5 flex flex-col">
		{#each items as d, i (d.key)}
			{@const n = computed[i]}
			{@const isOpen = open === d.key}
			<li class="flex flex-col">
				<button
					type="button"
					aria-expanded={isOpen}
					onclick={() => (open = isOpen ? null : d.key)}
					class={[
						'grid min-h-14 w-full grid-cols-[40px_minmax(0,1fr)_auto] items-center gap-3 rounded-input px-2.5 py-1.5 text-left hover:bg-surface2',
						isOpen && 'bg-surface2'
					]}
				>
					<FoodIcon
						icon={d.snapshot?.icon}
						name={d.kind === 'quick' ? d.name : (d.snapshot?.name ?? d.name)}
						brand={d.snapshot?.brand}
					/>
					<span class="min-w-0">
						<span class="line-clamp-2 text-[0.9375rem] font-semibold break-words">{d.name}</span>
						<span class={['block text-[0.8125rem]', n ? 'text-muted' : 'font-semibold text-bad']}
							>{!n
								? m.meal_editor_item_invalid()
								: d.kind === 'quick'
									? m.entry_quick()
									: quantityOf(d, measures)}</span
						>
					</span>
					<span class="text-[0.9375rem] font-semibold tabular-nums"
						><Roll value={n?.energy_kcal ? kcal(n.energy_kcal.value) : '?'} /></span
					>
				</button>
				<div class={['collapse-row', isOpen && 'open']}>
					<div inert={!isOpen}>
						<div class="flex flex-col gap-2.5 px-2.5 pt-2 pb-3.5 pl-[62px]">
							{#if d.kind === 'food' && d.snapshot}
								<AmountField
									id="amount-{d.key}"
									bind:amount={d.amountText}
									bind:unit={d.optionKey}
									units={optionsFor(d, measures).map((o) => ({ value: o.key, label: o.label }))}
								/>
								<dl
									class="flex flex-wrap gap-x-3.5 gap-y-1 text-[0.8125rem] text-muted tabular-nums"
								>
									{#each macros(asValues(n)) as macro (macro.label)}
										<div class="flex items-center gap-1.5">
											<span class="size-2 rounded-full" style:background={macro.color}></span>
											<dt class="sr-only">{macro.label}</dt>
											<dd class="font-bold"><Roll value={macro.value} /></dd>
										</div>
									{/each}
								</dl>
							{/if}
							<button
								type="button"
								onclick={() => remove(d.key)}
								class="min-h-8 self-start text-[0.875rem] font-bold text-bad">{removeLabel}</button
							>
						</div>
					</div>
				</div>
			</li>
		{/each}
		<li>
			<button
				type="button"
				onclick={() => (adding = true)}
				disabled={items.length >= 100}
				class="grid min-h-[52px] w-full grid-cols-[40px_minmax(0,1fr)] items-center gap-3 rounded-input px-2.5 text-left font-[650] text-accent disabled:opacity-50"
			>
				<span class="grid size-10 place-items-center rounded-small bg-soft"
					><Plus size={20} aria-hidden="true" /></span
				>
				<span>{m.meal_editor_add()}</span>
			</button>
		</li>
	</ul>
</section>

{#if adding}
	<AddFoodSheet {allowRecipes} {recent} onadd={add} onclose={() => (adding = false)} />
{/if}
