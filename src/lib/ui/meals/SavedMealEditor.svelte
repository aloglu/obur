<script lang="ts">
	// The saved meal editor (owner review 2026-10-30): a meal is a group of foods managed on its own; changing it
	// never logs it. Name, items (tap to change the amount or unit, or remove), Add food, then one Save sends the
	// whole meal. Kept items re-scale their own snapshot; only "Update to current food values" reads the catalog.
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import ChevronDown from '@lucide/svelte/icons/chevron-down';
	import Plus from '@lucide/svelte/icons/plus';
	import { onMount, untrack } from 'svelte';
	import { m } from '#lib/paraglide/messages.js';
	import { api, ApiError } from '#lib/client/api.ts';
	import { householdMeasures } from '#lib/client/measures.ts';
	import { showToast } from '#lib/client/toast.svelte.ts';
	import { snapshotNutrients } from '#lib/shared/diary-rules.ts';
	import type {
		EntryNutrients,
		FoodSnapshot,
		SavedMeal,
		SnapshotUnit
	} from '#lib/shared/diary-types.ts';
	import type { FoodDetail } from '#lib/shared/food-types.ts';
	import { kcal, quantityText } from '#lib/shared/format.ts';
	import type { NutrientValue } from '#lib/shared/nutrients.ts';
	import { formatDecimal, parseDecimal } from '#lib/shared/numbers.ts';
	import {
		optionKeyFor,
		snapshotUnitFor,
		unitOptions,
		type MeasureOption,
		type UnitOption
	} from '#lib/shared/unit-options.ts';
	import Button from '../Button.svelte';
	import Chips from '../Chips.svelte';
	import Notice from '../Notice.svelte';
	import TextField from '../TextField.svelte';
	import MacroPreview from '../log/MacroPreview.svelte';
	import AddFoodSheet from './AddFoodSheet.svelte';

	interface Props {
		/** The meal to edit, or null to create one. */
		meal: SavedMeal | null;
	}
	let { meal }: Props = $props();
	const start = untrack(() => meal);
	// A new meal's ID is chosen once, so a retried Save never creates it twice.
	const id = start?.id ?? crypto.randomUUID();

	interface Draft {
		key: string;
		/** A kept item, or a new food. */
		itemId?: string;
		foodId?: string;
		kind: 'food' | 'quick';
		name: string;
		snapshot: FoodSnapshot | null;
		amountText: string;
		optionKey: string;
		/** As saved, for kept items: only a change is sent. */
		startAmount?: number | null;
		startKey?: string;
		startUnit?: SnapshotUnit | null;
		stored: EntryNutrients;
	}

	const displayName = (s: { name: string; brand: string | null }) =>
		`${s.brand ? `${s.brand} ` : ''}${s.name}`;

	let name = $state(start?.name ?? '');
	let items = $state<Draft[]>(
		(start?.items ?? []).map((i) => ({
			key: i.id,
			itemId: i.id,
			kind: i.kind,
			name: i.kind === 'quick' ? (i.description ?? m.entry_quick()) : displayName(i.food!),
			snapshot: i.food,
			amountText: i.amount !== null ? formatDecimal(i.amount, ',', 2) : '',
			optionKey: i.unit ? optionKeyFor(i.unit) : '',
			startAmount: i.amount,
			startKey: i.unit ? optionKeyFor(i.unit) : '',
			startUnit: i.unit,
			stored: i.nutrients
		}))
	);
	let measures = $state<MeasureOption[]>([]);
	let open = $state<string | null>(null);
	let adding = $state(false);
	let busy = $state(false);
	let problem = $state('');
	let showErrors = $state(false);
	let confirmDelete = $state(false);

	onMount(async () => (measures = await householdMeasures()));

	const optionsFor = (d: Draft): UnitOption[] =>
		d.snapshot ? unitOptions(d.snapshot, measures, d.startUnit?.kind === 'basis_serving') : [];

	/** The item's nutrients as edited; undefined when the amount or unit can't be used. */
	function nutrientsOf(d: Draft): EntryNutrients | undefined {
		if (d.kind === 'quick' || !d.snapshot) return d.stored;
		const amount = parseDecimal(d.amountText);
		if (amount === undefined || amount <= 0) return undefined;
		const option = optionsFor(d).find((o) => o.key === d.optionKey);
		const unit = option
			? snapshotUnitFor(option.input, d.snapshot.servings, measures)
			: d.optionKey === d.startKey
				? (d.startUnit ?? undefined)
				: undefined;
		return unit && snapshotNutrients(d.snapshot, amount, unit);
	}
	const asValues = (n: EntryNutrients | undefined): NutrientValue[] | undefined =>
		n && (Object.entries(n).map(([code, v]) => ({ code, ...v })) as NutrientValue[]);

	const computed = $derived(items.map(nutrientsOf));
	const total = $derived(computed.reduce((sum, n) => sum + (n?.energy_kcal?.value ?? 0), 0));
	const partial = $derived(computed.some((n) => !n?.energy_kcal));
	const invalid = $derived(!name.trim() || items.length === 0 || computed.some((n) => !n));
	const dirty = $derived(
		!start ||
			name !== start.name ||
			items.length !== start.items.length ||
			items.some(
				(d, i) =>
					d.itemId !== start.items[i].id ||
					d.optionKey !== d.startKey ||
					parseDecimal(d.amountText) !== (d.startAmount ?? undefined)
			)
	);

	function quantityOf(d: Draft): string {
		if (d.kind === 'quick') return m.entry_quick();
		const amount = parseDecimal(d.amountText);
		const option = optionsFor(d).find((o) => o.key === d.optionKey);
		const unit =
			option && d.snapshot
				? snapshotUnitFor(option.input, d.snapshot.servings, measures)
				: d.startUnit;
		return amount !== undefined && unit
			? quantityText(amount, unit, d.snapshot?.servingLabel ?? null)
			: '—';
	}

	function addFood(food: FoodDetail, amount: number, option: UnitOption) {
		const key = crypto.randomUUID();
		items.push({
			key,
			foodId: food.id,
			kind: 'food',
			name: displayName(food),
			snapshot: {
				name: food.name,
				brand: food.brand,
				basis: food.basis,
				servingLabel: food.servingLabel,
				servingSize: food.servingSize ?? null,
				servings: food.servings,
				basisNutrients: food.nutrients
			},
			amountText: formatDecimal(amount, ',', 2),
			optionKey: option.key,
			stored: {}
		});
		adding = false;
	}

	function remove(key: string) {
		items = items.filter((d) => d.key !== key);
		open = null;
	}

	function payload() {
		return items.map((d) => {
			const option = optionsFor(d).find((o) => o.key === d.optionKey);
			const amount = parseDecimal(d.amountText)!;
			if (!d.itemId) return { foodId: d.foodId!, amount, unit: option!.input };
			if (d.kind === 'quick') return { itemId: d.itemId };
			const unitChanged = d.optionKey !== d.startKey;
			const amountChanged = amount !== d.startAmount;
			return {
				itemId: d.itemId,
				...(amountChanged || unitChanged ? { amount } : {}),
				...(unitChanged && option ? { unit: option.input } : {})
			};
		});
	}

	async function run(action: () => Promise<void>) {
		busy = true;
		problem = '';
		try {
			await action();
		} catch (e) {
			problem =
				e instanceof ApiError && (e.status === 409 || e.status === 404)
					? m.meal_editor_changed()
					: e instanceof ApiError && e.status === 422
						? m.amount_conversion_unknown()
						: m.error_generic();
		} finally {
			busy = false;
		}
	}

	const save = (event: SubmitEvent) => {
		event.preventDefault();
		showErrors = true;
		if (invalid) return;
		return run(async () => {
			const saved = await api<SavedMeal>('PUT', `/api/v1/saved-meals/${id}`, {
				revision: start?.revision ?? null,
				name,
				items: payload()
			});
			await goto(resolve('/(app)/saved-meals'), { invalidateAll: true });
			showToast({ message: m.meal_editor_saved({ name: saved.name }) });
		});
	};

	const refresh = () =>
		run(async () => {
			const result = await api<{ meal: SavedMeal; refreshed: number; kept: number }>(
				'POST',
				`/api/v1/saved-meals/${id}/refresh`,
				{ revision: start!.revision }
			);
			await goto(resolve('/(app)/saved-meals/[id]', { id }), { invalidateAll: true });
			showToast({
				message: m.saved_refreshed({
					refreshed: String(result.refreshed),
					kept: String(result.kept)
				})
			});
		});

	const removeMeal = () =>
		run(async () => {
			// A JSON body: SvelteKit refuses a bodyless cross-origin-looking DELETE behind the proxy as a form post.
			await api('DELETE', `/api/v1/saved-meals/${id}`, {});
			await goto(resolve('/(app)/saved-meals'), { invalidateAll: true });
			showToast({ message: m.saved_deleted({ name: start!.name }) });
		});
</script>

<form class="flex flex-col gap-3" onsubmit={save} novalidate>
	<section class="flex flex-col gap-3 rounded-card bg-surface p-[18px] shadow-card">
		<TextField
			label={m.meal_editor_name()}
			bind:value={name}
			maxlength={120}
			aria-invalid={showErrors && !name.trim()}
		/>
	</section>

	<section
		class="flex flex-col gap-2 rounded-card bg-surface p-[18px] shadow-card"
		aria-labelledby="meal-items"
	>
		<div class="flex items-baseline justify-between gap-3">
			<h2 id="meal-items" class="text-[19px] font-bold">{m.meal_editor_items()}</h2>
			<span class="text-[15px] font-semibold text-muted tabular-nums"
				>{kcal(total)}{partial ? '+' : ''} kcal</span
			>
		</div>
		{#if items.length === 0}
			<p class={['text-[14px]', showErrors ? 'font-semibold text-bad' : 'text-muted']}>
				{m.meal_editor_empty()}
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
						<span class="min-w-0 flex-1">
							<span class="line-clamp-2 text-[15px] font-semibold break-words">{d.name}</span>
							<span class={['block text-[13px]', n ? 'text-muted' : 'font-semibold text-bad']}
								>{n ? quantityOf(d) : m.meal_editor_item_invalid()}</span
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
									options={optionsFor(d).map((o) => ({ value: o.key, label: o.label }))}
								/>
								<MacroPreview nutrients={asValues(n)} />
							{/if}
							<Button variant="danger" onclick={() => remove(d.key)}
								>{m.meal_editor_remove()}</Button
							>
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

	{#if problem}<Notice>{problem}</Notice>{/if}
	<div class="grid grid-cols-2 gap-2">
		<a
			href={resolve('/(app)/saved-meals')}
			class="inline-flex min-h-[52px] items-center justify-center rounded-button border border-line bg-surface text-[17px] font-[750]"
			>{m.common_cancel()}</a
		>
		<Button type="submit" disabled={busy || !dirty}
			>{busy ? m.common_working() : m.meal_editor_save()}</Button
		>
	</div>

	{#if start}
		<section
			class="mt-2 flex flex-col gap-2 rounded-card bg-surface p-[18px] shadow-card"
			aria-labelledby="meal-more"
		>
			<h2 id="meal-more" class="text-[19px] font-bold">{m.meal_editor_more()}</h2>
			<Button variant="ghost" disabled={busy || dirty} onclick={refresh}>{m.saved_refresh()}</Button
			>
			<p class="text-[13px] text-muted">
				{dirty ? m.meal_editor_save_first() : m.saved_refresh_hint()}
			</p>
			{#if confirmDelete}
				<p class="text-[14px]">{m.saved_delete_hint()}</p>
				<div class="grid grid-cols-2 gap-2">
					<Button variant="ghost" onclick={() => (confirmDelete = false)}
						>{m.common_cancel()}</Button
					>
					<Button variant="danger" disabled={busy} onclick={removeMeal}
						>{m.saved_delete_confirm()}</Button
					>
				</div>
			{:else}
				<Button variant="danger" onclick={() => (confirmDelete = true)}>{m.saved_delete()}</Button>
			{/if}
		</section>
	{/if}
</form>

{#if adding}
	<AddFoodSheet onadd={addFood} onclose={() => (adding = false)} />
{/if}
