<script lang="ts">
	// docs/ui.md "Picking a food": basis line, amount with unit chips, day chips, meal chips, live preview, Save.
	import AmountField from '../AmountField.svelte';
	import DayMealFields from '../DayMealFields.svelte';
	import { onMount, untrack } from 'svelte';
	import { m } from '#lib/paraglide/messages.js';
	import { api, ApiError } from '#lib/client/api.ts';
	import { submit } from '#lib/client/offline/sync.svelte.ts';
	import { householdMeasures } from '#lib/client/measures.ts';
	import { deviceZone } from '#lib/client/prefs.ts';
	import { addDays, isLateNight } from '#lib/shared/diary-rules.ts';
	import type { DiaryEntry, Meal } from '#lib/shared/diary-types.ts';
	import type { FoodDetail } from '#lib/shared/food-types.ts';
	import { dayTitle, kcal, mealName } from '#lib/shared/format.ts';
	import { MEALS } from '#lib/shared/diary-types.ts';
	import { formatDecimal, parseDecimal } from '#lib/shared/numbers.ts';
	import { basisFactor, scaleNutrients, type Unit } from '#lib/shared/quantity.ts';
	import { unitOptions, type MeasureOption, type UnitOption } from '#lib/shared/unit-options.ts';
	import Button from '../Button.svelte';
	import Notice from '../Notice.svelte';
	import Sheet from '../Sheet.svelte';
	import MacroPreview from './MacroPreview.svelte';

	interface Props {
		foodId: string;
		date: string;
		today: string;
		meal: Meal;
		/** The saved entry, or null when it was kept on this device to send later. */
		onsaved: (entry: DiaryEntry | null) => void;
		onclose: () => void;
	}
	let { foodId, date, today, meal: presetMeal, onsaved, onclose }: Props = $props();

	let food = $state<FoodDetail | undefined>();
	let measures = $state<MeasureOption[]>([]);
	let optionKey = $state('');
	let amountText = $state('');
	let day = $state(untrack(() => date));
	let meal = $state<Meal>(untrack(() => presetMeal));
	let busy = $state(false);
	let problem = $state('');

	const options = $derived<UnitOption[]>(food ? unitOptions(food, measures) : []);
	const option = $derived(options.find((o) => o.key === optionKey));
	const amount = $derived(parseDecimal(amountText));
	const dayOptions = $derived(date === today ? [today, addDays(today, -1)] : [date, today]);
	const lateNight = $derived(day === today && isLateNight(new Date(), deviceZone()));

	onMount(async () => {
		[food, measures] = await Promise.all([
			api<FoodDetail>('GET', `/api/v1/foods/${foodId}`),
			householdMeasures()
		]);
		const first = unitOptions(food, measures)[0];
		optionKey = first?.key ?? '';
		amountText = first ? formatDecimal(first.defaultAmount, ',', 2) : '';
	});

	function toUnit(o: UnitOption): Unit {
		const i = o.input;
		if (i.kind === 'measure')
			return { kind: 'measure', ml: measures.find((x) => x.code === i.code)!.ml };
		return i;
	}

	/** The nutrients for the chosen amount, or undefined while the amount or unit is missing. */
	const preview = $derived.by(() => {
		if (!food || !option || amount === undefined) return undefined;
		const factor = basisFactor(food, amount, toUnit(option));
		return factor === undefined ? undefined : scaleNutrients(food.nutrients, factor);
	});

	const basisLine = $derived.by(() => {
		if (!food) return '';
		const e = food.nutrients.find((n) => n.code === 'energy_kcal');
		const per =
			food.basis === 'serving'
				? (food.servingLabel ?? '')
				: food.basis === '100g'
					? '100 g'
					: '100 ml';
		return e ? m.amount_basis({ kcal: kcal(e.value), basis: per }) : m.foods_kcal_unknown();
	});

	async function save(event: SubmitEvent) {
		event.preventDefault();
		if (!food || !option || amount === undefined || amount <= 0) return;
		busy = true;
		problem = '';
		try {
			const scaled = basisFactor(food, amount, toUnit(option));
			const kcalValue = food.nutrients.find((n) => n.code === 'energy_kcal')?.value;
			const quantity =
				option.input.kind === 'mass' || option.input.kind === 'volume'
					? `${formatDecimal(amount, ',', 2)} ${option.label}`
					: `${formatDecimal(amount, ',', 2)} × ${option.label}`;
			const result = await submit<DiaryEntry>(
				'/api/v1/diary/entries',
				{
					kind: 'food',
					id: crypto.randomUUID(),
					date: day,
					meal,
					zone: deviceZone(),
					foodId: food.id,
					amount,
					unit: option.input
				},
				{
					kind: 'diary',
					localDate: day,
					meal,
					name: `${food.brand ? `${food.brand} ` : ''}${food.name}`,
					quantity,
					kcal: kcalValue !== undefined && scaled !== undefined ? kcalValue * scaled : null
				}
			);
			onsaved(result.status === 'sent' ? result.data : null);
		} catch (e) {
			problem =
				e instanceof ApiError && e.status === 422
					? m.amount_conversion_unknown()
					: m.error_generic();
		} finally {
			busy = false;
		}
	}
</script>

<Sheet
	title={food ? `${food.brand ? `${food.brand} ` : ''}${food.name}` : m.amount_title()}
	{onclose}
>
	{#if food}
		<p class="text-[14px] text-muted">{basisLine}</p>
		<form class="flex flex-col gap-4" onsubmit={save}>
			<div class="flex flex-col gap-1.5">
				<AmountField
					id="amount"
					bind:amount={amountText}
					bind:unit={optionKey}
					units={options.map((o) => ({ value: o.key, label: o.label }))}
					invalid={amount === undefined}
					onunit={(key) =>
						(amountText = formatDecimal(options.find((o) => o.key === key)!.defaultAmount, ',', 2))}
				/>
				{#if amountText.trim() && amount === undefined}<p class="text-[13px] text-bad">
						{m.amount_invalid()}
					</p>{/if}
			</div>
			{#if lateNight}<Notice tone="info">{m.amount_late_night()}</Notice>{/if}
			<DayMealFields
				bind:day
				days={dayOptions.map((d) => ({ value: d, label: dayTitle(d, today) }))}
				bind:meal
				meals={MEALS.map((x) => ({ value: x, label: mealName(x) }))}
			/>
			<MacroPreview nutrients={preview} />
			{#if problem}<Notice>{problem}</Notice>{/if}
			<Button type="submit" wide disabled={busy || amount === undefined || !preview}
				>{busy ? m.common_working() : m.amount_save()}</Button
			>
		</form>
	{:else}
		<p class="text-[14px] text-muted">{m.common_working()}</p>
	{/if}
</Sheet>
