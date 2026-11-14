<script lang="ts">
	// Adds a food in the saved meal and recipe editors: search, or Recent before typing, then the amount and unit with the
	// live preview.
	// Nothing is saved here; the editor's Save sends everything.
	import AmountField from '../AmountField.svelte';
	import { onMount } from 'svelte';
	import { m } from '#lib/paraglide/messages.js';
	import { api } from '#lib/client/api.ts';
	import { householdMeasures } from '#lib/client/measures.ts';
	import type { FoodDetail, FoodSearchResult } from '#lib/shared/food-types.ts';
	import { kcal } from '#lib/shared/format.ts';
	import { formatDecimal, parseDecimal } from '#lib/shared/numbers.ts';
	import { basisFactor, scaleNutrients } from '#lib/shared/quantity.ts';
	import { unitOptions, type MeasureOption, type UnitOption } from '#lib/shared/unit-options.ts';
	import Button from '../Button.svelte';
	import Notice from '../Notice.svelte';
	import Sheet from '../Sheet.svelte';
	import TextField from '../TextField.svelte';
	import MacroPreview from '../log/MacroPreview.svelte';

	interface Props {
		/** False in a recipe: recipes can't be ingredients (yet). */
		allowRecipes?: boolean;
		/** Loaded with the editor, so they are ready when the sheet opens. */
		recent?: FoodSearchResult[];
		onadd: (food: FoodDetail, amount: number, option: UnitOption) => void;
		onclose: () => void;
	}
	let { allowRecipes = true, recent = [], onadd, onclose }: Props = $props();

	let query = $state('');
	let results = $state<FoodSearchResult[]>([]);
	// The sheet slides in small, as sheets do, and then the list makes it grow.
	let opened = $state(false);
	let searched = $state(false);
	let food = $state<FoodDetail | undefined>();
	let measures = $state<MeasureOption[]>([]);
	let optionKey = $state('');
	let amountText = $state('');
	let timer: ReturnType<typeof setTimeout> | undefined;

	onMount(async () => (measures = await householdMeasures()));

	$effect(() => {
		const q = query.trim();
		clearTimeout(timer);
		if (!q) {
			results = [];
			searched = false;
			return;
		}
		timer = setTimeout(async () => {
			const data = await api<{ results: FoodSearchResult[] }>(
				'GET',
				`/api/v1/foods?q=${encodeURIComponent(q)}`
			);
			if (q === query.trim()) {
				results = data.results;
				searched = true;
			}
		}, 200);
	});

	const options = $derived<UnitOption[]>(food ? unitOptions(food, measures) : []);
	const option = $derived(options.find((o) => o.key === optionKey));
	const amount = $derived(parseDecimal(amountText));
	const nested = $derived(!allowRecipes && food?.origin === 'recipe');
	const preview = $derived.by(() => {
		if (!food || !option || amount === undefined) return undefined;
		const i = option.input;
		const unit =
			i.kind === 'measure'
				? { kind: 'measure' as const, ml: measures.find((x) => x.code === i.code)!.ml }
				: i;
		const factor = basisFactor(food, amount, unit);
		return factor === undefined ? undefined : scaleNutrients(food.nutrients, factor);
	});

	async function pick(id: string) {
		food = await api<FoodDetail>('GET', `/api/v1/foods/${id}`);
		const first = unitOptions(food, measures)[0];
		optionKey = first?.key ?? '';
		amountText = first ? formatDecimal(first.defaultAmount, 2) : '';
	}

	function add(event: SubmitEvent) {
		event.preventDefault();
		if (food && option && amount !== undefined && amount > 0 && preview)
			onadd(food, amount, option);
	}
</script>

{#snippet search()}
	<TextField
		label={m.foods_search()}
		placeholder={m.foods_search_placeholder()}
		bind:value={query}
		type="search"
		autocomplete="off"
	/>
{/snippet}

{#snippet foods(list: FoodSearchResult[])}
	<ul class="-mx-2 flex flex-col empty:hidden">
		{#each list as r (r.id)}
			<li>
				<button
					type="button"
					onclick={() => pick(r.id)}
					data-prepare-touch={`/api/v1/foods/${r.id}`}
					class="flex min-h-14 w-full items-center justify-between gap-3 rounded-input px-2 py-2 text-left hover:bg-surface2"
				>
					<span class="line-clamp-2 min-w-0 text-[0.9375rem] font-semibold break-words"
						>{r.brand ? `${r.brand} ` : ''}{r.name}</span
					>
					<span class="shrink-0 text-[0.8125rem] text-muted tabular-nums"
						>{r.kcal === null ? '?' : kcal(r.kcal)} kcal</span
					>
				</button>
			</li>
		{/each}
	</ul>
{/snippet}

<Sheet
	title={food ? `${food.brand ? `${food.brand} ` : ''}${food.name}` : m.meal_editor_add_title()}
	pinned={food ? undefined : search}
	resizes
	onopened={() => (opened = true)}
	{onclose}
>
	{#if !food}
		{#if searched && results.length === 0}
			<p class="text-[0.875rem] text-muted">{m.foods_none()}</p>
		{/if}
		{#if query.trim()}
			{@render foods(results)}
		{:else if opened && recent.length > 0}
			<section class="flex flex-col gap-1" aria-labelledby="add-food-recent">
				<h3 id="add-food-recent" class="text-[0.8125rem] font-[650] text-muted">
					{m.log_recent()}
				</h3>
				{@render foods(recent)}
			</section>
		{/if}
	{:else}
		<form class="flex flex-col gap-4" onsubmit={add}>
			<AmountField
				id="meal-add-amount"
				bind:amount={amountText}
				bind:unit={optionKey}
				units={options.map((o) => ({ value: o.key, label: o.label }))}
				invalid={amount === undefined}
				onunit={(key) =>
					(amountText = formatDecimal(options.find((o) => o.key === key)!.defaultAmount, 2))}
			/>
			<MacroPreview nutrients={preview} />
			{#if nested}<Notice>{m.recipe_no_nesting()}</Notice>{/if}
			<div class="grid grid-cols-2 gap-2">
				<Button variant="ghost" onclick={() => (food = undefined)}>{m.meal_editor_back()}</Button>
				<Button type="submit" disabled={amount === undefined || !preview || nested}
					>{m.meal_editor_add_confirm()}</Button
				>
			</div>
		</form>
	{/if}
</Sheet>
