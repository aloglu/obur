<script lang="ts">
	// docs/ui.md "Logging": the amount sheet in edit mode. Its button says what it will do: No changes, Move to a meal, or
	// Save changes. Delete is immediate and the toast offers Undo. Only this entry changes, never the food.
	import AmountField from '../AmountField.svelte';
	import { onMount, untrack } from 'svelte';
	import { m } from '#lib/paraglide/messages.js';
	import { api, ApiError } from '#lib/client/api.ts';
	import { householdMeasures } from '#lib/client/measures.ts';
	import { addDays, snapshotNutrients } from '#lib/shared/diary-rules.ts';
	import { MEALS, type DiaryEntry, type Meal } from '#lib/shared/diary-types.ts';
	import { dayTitle, mealShortName, mealNameTo } from '#lib/shared/format.ts';
	import { formatDecimal, parseDecimal } from '#lib/shared/numbers.ts';
	import {
		optionKeyFor,
		snapshotUnitFor,
		unitOptions,
		type MeasureOption
	} from '#lib/shared/unit-options.ts';
	import Trash2 from '@lucide/svelte/icons/trash-2';
	import Button from '../Button.svelte';
	import DayMealFields from '../DayMealFields.svelte';
	import FoodSheetHead from './FoodSheetHead.svelte';
	import Notice from '../Notice.svelte';
	import Sheet from '../Sheet.svelte';
	import MacroPreview from './MacroPreview.svelte';
	import type { NutrientValue } from '#lib/shared/nutrients.ts';
	import TextField from '../TextField.svelte';

	interface Props {
		entry: DiaryEntry;
		onsaved: (entry: DiaryEntry, movedTo?: Meal) => void;
		ondeleted: (entry: DiaryEntry) => void;
		onconflict: () => void;
		onclose: () => void;
		today: string;
	}
	let { entry, today, onsaved, ondeleted, onconflict, onclose }: Props = $props();
	const start = untrack(() => entry);

	let measures = $state<MeasureOption[]>([]);
	let optionKey = $state(start.unit ? optionKeyFor(start.unit) : '');
	let amountText = $state(start.amount !== null ? formatDecimal(start.amount, 2) : '');
	let kcalText = $state(formatDecimal(start.nutrients.energy_kcal?.value ?? 0, 0));
	let description = $state(start.description ?? '');
	let day = $state(start.localDate);
	let meal = $state<Meal>(start.meal);
	let busy = $state(false);
	let problem = $state('');

	onMount(async () => (measures = await householdMeasures()));

	const snapshot = start.food;
	const options = $derived(
		snapshot ? unitOptions(snapshot, measures, start.unit?.kind === 'basis_serving') : []
	);
	const option = $derived(options.find((o) => o.key === optionKey));
	const amount = $derived(parseDecimal(amountText));
	const kcalValue = $derived(parseDecimal(kcalText));
	const name =
		start.kind === 'quick'
			? (start.description ?? m.entry_quick())
			: `${snapshot?.brand ? `${snapshot.brand} ` : ''}${snapshot?.name ?? ''}`;

	const storedUnit = $derived(
		option && snapshotUnitFor(option.input, snapshot?.servings ?? [], measures)
	);
	const preview = $derived.by(() => {
		if (!snapshot || !storedUnit || amount === undefined) return undefined;
		const scaled = snapshotNutrients(snapshot, amount, storedUnit);
		return scaled && Object.entries(scaled).map(([code, v]) => ({ code, ...v }) as NutrientValue);
	});

	async function patch(body: Record<string, unknown>, movedTo?: Meal) {
		busy = true;
		problem = '';
		try {
			onsaved(
				await api<DiaryEntry>('PATCH', `/api/v1/diary/entries/${start.id}`, {
					revision: start.revision,
					...body
				}),
				movedTo
			);
		} catch (e) {
			if (e instanceof ApiError && (e.code === 'conflict' || e.code === 'not_found')) onconflict();
			else problem = m.error_generic();
		} finally {
			busy = false;
		}
	}

	const { startAmount, startKcal, startKey, startDescription } = untrack(() => ({
		startAmount: amountText,
		startKcal: kcalText,
		startKey: optionKey,
		startDescription: description
	}));
	const placeChanged = $derived(day !== start.localDate || meal !== start.meal);
	const valueChanged = $derived(
		start.kind === 'quick'
			? kcalText !== startKcal || description !== startDescription
			: amountText !== startAmount || optionKey !== startKey
	);
	const dayOptions = $derived(
		[...new Set([start.localDate, today, addDays(today, -1)])].sort().reverse()
	);
	const valid = $derived(
		start.kind === 'quick'
			? kcalValue !== undefined && kcalValue > 0
			: option !== undefined && amount !== undefined && amount > 0
	);

	function save(event: SubmitEvent) {
		event.preventDefault();
		if (!valid || !(placeChanged || valueChanged)) return;
		const place = placeChanged ? { meal, date: day } : {};
		const movedTo = placeChanged ? meal : undefined;
		if (!valueChanged) patch(place, movedTo);
		else if (start.kind === 'quick')
			patch({ kcal: kcalValue, description: description || null, ...place }, movedTo);
		else patch({ amount, unit: option!.input, ...place }, movedTo);
	}

	async function remove() {
		busy = true;
		try {
			ondeleted(
				await api<DiaryEntry>('POST', `/api/v1/diary/entries/${start.id}?action=delete`, {})
			);
		} catch {
			problem = m.error_generic();
		} finally {
			busy = false;
		}
	}
</script>

<Sheet title={m.edit_title()} {onclose}>
	{#snippet head()}
		<FoodSheetHead
			{name}
			iconName={start.kind === 'quick' ? (start.description ?? '') : (snapshot?.name ?? '')}
			icon={snapshot?.icon}
			brand={snapshot?.brand}
			detail={m.edit_title()}
		/>
	{/snippet}
	<form class="flex flex-col gap-4" onsubmit={save}>
		{#if start.kind === 'quick'}
			<TextField label={m.quick_kcal()} bind:value={kcalText} inputmode="decimal" />
			<TextField label={m.quick_description()} bind:value={description} maxlength={200} />
		{:else}
			<AmountField
				id="edit-amount"
				bind:amount={amountText}
				bind:unit={optionKey}
				units={options.map((o) => ({ value: o.key, label: o.label }))}
			/>
		{/if}
		<DayMealFields
			bind:day
			days={dayOptions.map((d) => ({ value: d, label: dayTitle(d, today) }))}
			bind:meal
			meals={MEALS.map((x) => ({ value: x, label: mealShortName(x) }))}
		/>
		{#if start.kind !== 'quick'}
			<MacroPreview nutrients={preview} />
			<p class="-mt-1 text-[0.8125rem] text-muted">{m.edit_only_this()}</p>
		{/if}
		{#if problem}<Notice>{problem}</Notice>{/if}
		<div class="grid grid-cols-[auto_minmax(0,1fr)] gap-2">
			<button
				type="button"
				disabled={busy}
				onclick={remove}
				class="inline-flex min-h-[52px] items-center gap-1.5 rounded-button bg-surface2 px-4 text-[0.9375rem] font-bold text-bad disabled:opacity-50"
			>
				<Trash2 size={18} aria-hidden="true" />{m.edit_delete()}
			</button>
			<Button type="submit" wide disabled={busy || !valid || !(placeChanged || valueChanged)}>
				{#if !placeChanged && !valueChanged}
					{m.edit_no_changes()}
				{:else if placeChanged && !valueChanged}
					{m.edit_move_to({ meal: mealNameTo(meal) })}
				{:else}
					{m.edit_save()}
				{/if}
			</Button>
		</div>
	</form>
</Sheet>
