<script lang="ts">
	// The food list of the saved meal and recipe editors: each item a row (name, quantity, kcal) that expands to its
	// amount, unit chips, the macro preview and Remove; Add food below. Nothing is saved here.
	import ChevronDown from '@lucide/svelte/icons/chevron-down';
	import Plus from '@lucide/svelte/icons/plus';
	import { m } from '#lib/paraglide/messages.js';
	import type { FoodDetail } from '#lib/shared/food-types.ts';
	import { kcal } from '#lib/shared/format.ts';
	import type { MeasureOption, UnitOption } from '#lib/shared/unit-options.ts';
	import Button from '../Button.svelte';
	import FoodIcon from '../FoodIcon.svelte';
	import Chips from '../Chips.svelte';
	import MacroPreview from '../log/MacroPreview.svelte';
	import AddFoodSheet from './AddFoodSheet.svelte';
	import { asValues, newDraft, nutrientsOf, optionsFor, quantityOf, type Draft } from './drafts.ts';

	interface Props {
		title: string;
		items: Draft[];
		measures: MeasureOption[];
		emptyText: string;
		showErrors: boolean;
		/** Recipes can't contain recipes (yet). */
		allowRecipes?: boolean;
	}
	let {
		title,
		items = $bindable(),
		measures,
		emptyText,
		showErrors,
		allowRecipes = true
	}: Props = $props();

	let open = $state<string | null>(null);
	let adding = $state(false);

	const computed = $derived(items.map((d) => nutrientsOf(d, measures)));
	const total = $derived(computed.reduce((sum, n) => sum + (n?.energy_kcal?.value ?? 0), 0));
	const partial = $derived(computed.some((n) => !n?.energy_kcal));

	function add(food: FoodDetail, amount: number, option: UnitOption) {
		items.push(newDraft(food, amount, option));
		adding = false;
	}

	function remove(key: string) {
		items = items.filter((d) => d.key !== key);
		open = null;
	}
</script>

<section
	class="flex flex-col gap-2 rounded-card bg-surface p-[18px] shadow-card"
	aria-labelledby="items-title"
>
	<div class="flex items-baseline justify-between gap-3">
		<h2 id="items-title" class="text-[19px] font-bold">{title}</h2>
		<span class="text-[15px] font-semibold text-muted tabular-nums"
			>{kcal(total)}{partial ? '+' : ''} kcal</span
		>
	</div>
	{#if items.length === 0}
		<p class={['text-[14px]', showErrors ? 'font-semibold text-bad' : 'text-muted']}>
			{emptyText}
		</p>
	{/if}
	<ul class="-mx-2 flex flex-col">
		{#each items as d, i (d.key)}
			{@const n = computed[i]}
			<li class="flex flex-col">
				<button
					type="button"
					aria-expanded={open === d.key}
					onclick={() => (open = open === d.key ? null : d.key)}
					class="flex min-h-14 w-full items-center gap-3 rounded-input px-2 py-2 text-left hover:bg-surface2"
				>
					<FoodIcon
						icon={d.snapshot?.icon}
						name={d.kind === 'quick' ? d.name : (d.snapshot?.name ?? d.name)}
						brand={d.snapshot?.brand}
					/>
					<span class="min-w-0 flex-1">
						<span class="line-clamp-2 text-[15px] font-semibold break-words">{d.name}</span>
						<span class={['block text-[13px]', n ? 'text-muted' : 'font-semibold text-bad']}
							>{!n
								? m.meal_editor_item_invalid()
								: d.kind === 'quick'
									? m.entry_quick()
									: quantityOf(d, measures)}</span
						>
					</span>
					<span class="shrink-0 text-[15px] font-semibold tabular-nums"
						>{n?.energy_kcal ? kcal(n.energy_kcal.value) : '?'}</span
					>
					<ChevronDown
						size={18}
						aria-hidden="true"
						class={[
							'shrink-0 text-muted transition-transform motion-reduce:transition-none',
							open === d.key && 'rotate-180'
						]}
					/>
				</button>
				{#if open === d.key}
					<div class="flex flex-col gap-3 px-2 pt-1 pb-3">
						{#if d.kind === 'food' && d.snapshot}
							<div class="flex flex-col gap-1.5">
								<label for="amount-{d.key}" class="text-[13px] font-[650] text-muted"
									>{m.amount_amount()}</label
								>
								<input
									id="amount-{d.key}"
									bind:value={d.amountText}
									inputmode="decimal"
									autocomplete="off"
									class="min-h-12 rounded-input border border-line bg-surface2 px-3.5 text-[18px] font-bold tabular-nums"
								/>
							</div>
							<Chips
								label={m.amount_unit()}
								bind:value={d.optionKey}
								options={optionsFor(d, measures).map((o) => ({ value: o.key, label: o.label }))}
							/>
							<MacroPreview nutrients={asValues(n)} />
						{/if}
						<Button variant="danger" onclick={() => remove(d.key)}>{m.meal_editor_remove()}</Button>
					</div>
				{/if}
			</li>
		{/each}
	</ul>
	<button
		type="button"
		onclick={() => (adding = true)}
		disabled={items.length >= 100}
		class="inline-flex min-h-11 items-center justify-center gap-2 rounded-full bg-soft px-4 text-[15px] font-bold text-accent disabled:opacity-50"
	>
		<Plus size={18} aria-hidden="true" />{m.meal_editor_add()}
	</button>
</section>

{#if adding}
	<AddFoodSheet {allowRecipes} onadd={add} onclose={() => (adding = false)} />
{/if}
