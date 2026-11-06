<script lang="ts">
	// Create or edit a food. Layout follows the label-scan confirmation in docs/ui.md (basis chips, one row per
	// value, empty rows highlighted as unknown). Food editing itself is not designed yet; see docs/ui.md.
	import ChevronRight from '@lucide/svelte/icons/chevron-right';
	import { untrack } from 'svelte';
	import { m } from '#lib/paraglide/messages.js';
	import { foodWarnings, type FoodWarning } from '#lib/shared/food-checks.ts';
	import type { FoodInput } from '#lib/shared/food-input.ts';
	import type { FoodDetail } from '#lib/shared/food-types.ts';
	import { EXTRA_CODES, portionSource, preservedNutrients } from '#lib/shared/food-edit.ts';
	import { deriveNutrients, type NutrientCode, type NutrientValue } from '#lib/shared/nutrients.ts';
	import { formatDecimal, parseDecimal } from '#lib/shared/numbers.ts';
	import type { Basis } from '#lib/shared/quantity.ts';
	import { suggestIcon } from '#lib/shared/food-icons.ts';
	import Button from '../Button.svelte';
	import FoodIcon from '../FoodIcon.svelte';
	import IconPicker from './IconPicker.svelte';
	import Notice from '../Notice.svelte';
	import Select from '../Select.svelte';
	import TextField from '../TextField.svelte';

	interface Props {
		initial?: FoodDetail;
		busy?: boolean;
		onsave: (food: FoodInput) => void;
		/** A name to start from, for a new food. */
		startName?: string;
		/** The save button's words, where saving also does something else. */
		saveLabel?: string;
	}

	const UNITS: { value: 'g' | 'ml'; label: string }[] = [
		{ value: 'g', label: 'g' },
		{ value: 'ml', label: 'ml' }
	];
	let { initial, busy = false, onsave, startName = '', saveLabel }: Props = $props();
	const start = untrack(() => initial);

	type Field =
		| 'energy_kcal'
		| 'energy_kj'
		| 'fat'
		| 'saturated_fat'
		| 'carbohydrate'
		| 'sugars'
		| 'fibre'
		| 'protein'
		| 'salt';
	type Extra = (typeof EXTRA_CODES)[number];
	const FIELDS: Field[] = [
		'energy_kcal',
		'energy_kj',
		'fat',
		'saturated_fat',
		'carbohydrate',
		'sugars',
		'fibre',
		'protein',
		'salt'
	];

	const reported = (code: NutrientCode) =>
		start?.nutrients.find(
			(n) => n.code === code && (n.qualifier === 'reported' || n.qualifier === 'less_than')
		);

	let labelType = $state<'eu' | 'us'>(
		reported('carbohydrate_total') || reported('sodium') ? 'us' : 'eu'
	);
	const codeFor = (field: Field): NutrientCode =>
		field === 'carbohydrate'
			? labelType === 'eu'
				? 'carbohydrate_excl_fibre'
				: 'carbohydrate_total'
			: field === 'salt' && labelType === 'us'
				? 'sodium'
				: field;

	function initialRow(field: Field) {
		const codes: NutrientCode[] =
			field === 'carbohydrate'
				? ['carbohydrate_excl_fibre', 'carbohydrate_total']
				: field === 'salt'
					? ['salt', 'sodium']
					: [field];
		const found = codes.map(reported).find(Boolean);
		return {
			text: found ? formatDecimal(found.value, ',', 4) : '',
			lessThan: found?.qualifier === 'less_than'
		};
	}

	let name = $state(start?.name || untrack(() => startName));
	let brand = $state(start?.brand ?? '');
	// The chosen icon; null shows the one the name suggests (it follows the name as it is typed).
	let icon = $state<string | null>(start?.icon ?? null);
	let choosingIcon = $state(false);
	const suggested = $derived(suggestIcon(name, brand));
	let visibility = $state<'shared' | 'private'>(start?.visibility ?? 'shared');
	let basis = $state<Basis>(start?.basis ?? '100g');
	let servingLabel = $state(start?.servingLabel ?? '');
	let servingSizeText = $state(
		start?.servingSize ? formatDecimal(start.servingSize.amount, ',', 4) : ''
	);
	let servingSizeUnit = $state<'g' | 'ml'>(start?.servingSize?.unit ?? 'g');
	let rows = $state(
		Object.fromEntries(FIELDS.map((f) => [f, initialRow(f)])) as Record<
			Field,
			{ text: string; lessThan: boolean }
		>
	);
	let portions = $state(
		(start?.servings ?? []).map((s) => ({
			name: s.name,
			text: formatDecimal(s.amount, ',', 4),
			unit: s.unit
		}))
	);
	let extras = $state(
		Object.fromEntries(
			EXTRA_CODES.map((code) => {
				const found = reported(code);
				return [
					code,
					{
						text: found ? formatDecimal(found.value, ',', 4) : '',
						lessThan: found?.qualifier === 'less_than'
					}
				];
			})
		) as Record<Extra, { text: string; lessThan: boolean }>
	);
	const extrasOpen = untrack(() => EXTRA_CODES.some((c) => extras[c].text !== ''));
	let showErrors = $state(false);

	const values = $derived.by(() => {
		const out: NutrientValue[] = [];
		for (const field of FIELDS) {
			const value = parseDecimal(rows[field].text);
			if (value !== undefined) {
				out.push({
					code: codeFor(field),
					value,
					qualifier: rows[field].lessThan ? 'less_than' : 'reported'
				});
			}
		}
		for (const code of EXTRA_CODES) {
			const value = parseDecimal(extras[code].text);
			if (value !== undefined)
				out.push({ code, value, qualifier: extras[code].lessThan ? 'less_than' : 'reported' });
		}
		return out;
	});
	const invalid = (text: string) => text.trim() !== '' && parseDecimal(text) === undefined;
	const warnings = $derived<FoodWarning[]>(foodWarnings(basis, deriveNutrients(values)));
	const label = (field: Field) =>
		({
			energy_kcal: m.nutrient_energy_kcal(),
			energy_kj: m.nutrient_energy_kj(),
			fat: m.nutrient_fat(),
			saturated_fat: m.nutrient_saturated_fat(),
			carbohydrate:
				labelType === 'eu' ? m.nutrient_carbohydrate() : m.nutrient_carbohydrate_total(),
			sugars: m.nutrient_sugars(),
			fibre: m.nutrient_fibre(),
			protein: m.nutrient_protein(),
			salt: labelType === 'eu' ? m.nutrient_salt() : m.nutrient_sodium()
		})[field];
	const extraLabel: Record<Extra, () => string> = {
		monounsaturated_fat: m.nutrient_monounsaturated_fat,
		polyunsaturated_fat: m.nutrient_polyunsaturated_fat,
		trans_fat: m.nutrient_trans_fat,
		cholesterol: m.nutrient_cholesterol,
		starch: m.nutrient_starch,
		polyols: m.nutrient_polyols,
		calcium: m.nutrient_calcium,
		potassium: m.nutrient_potassium,
		iron: m.nutrient_iron
	};
	const warningText: Record<FoodWarning, () => string> = {
		sugars_exceed_carbohydrate: m.warning_sugars_exceed_carbohydrate,
		saturated_exceeds_fat: m.warning_saturated_exceeds_fat,
		mass_exceeds_100: m.warning_mass_exceeds_100,
		energy_units_mismatch: m.warning_energy_units_mismatch,
		energy_macros_mismatch: m.warning_energy_macros_mismatch,
		salt_sodium_mismatch: m.warning_salt_sodium_mismatch,
		energy_missing: m.warning_energy_missing
	};

	function submit(event: SubmitEvent) {
		event.preventDefault();
		showErrors = true;
		const anyInvalid =
			FIELDS.some((f) => invalid(rows[f].text)) ||
			EXTRA_CODES.some((c) => invalid(extras[c].text)) ||
			portions.some((p) => parseDecimal(p.text) === undefined || !p.name.trim()) ||
			(basis === 'serving' && invalid(servingSizeText));
		if (anyInvalid || !name.trim() || (basis === 'serving' && !servingLabel.trim())) return;
		const size = basis === 'serving' ? parseDecimal(servingSizeText) : undefined;
		onsave({
			name,
			brand: brand || null,
			visibility,
			basis,
			servingLabel: basis === 'serving' ? servingLabel : null,
			servingSize: size ? { amount: size, unit: servingSizeUnit } : null,
			barcode: start?.barcode ?? null,
			icon,
			// Values the form does not show are kept while the basis stays the same (food-edit.ts).
			nutrients: [
				...values,
				...preservedNutrients(
					start?.nutrients ?? [],
					basis === start?.basis,
					values.map((v) => v.code)
				)
			],
			servings: portions.map((p) => {
				const portion = { name: p.name, amount: parseDecimal(p.text)!, unit: p.unit };
				return { ...portion, source: portionSource(start?.servings ?? [], portion) };
			})
		});
	}

	const chip = (active: boolean) => [
		'min-h-11 rounded-input px-2 py-1.5 text-[15px] leading-tight font-semibold border',
		active ? 'bg-soft text-accent border-accent' : 'bg-surface2 text-text border-line'
	];
</script>

{#snippet row(id: string, text: string, value: { text: string; lessThan: boolean }, core: boolean)}
	{@const empty = value.text.trim() === ''}
	{@const bad = invalid(value.text)}
	<!-- Core rows mark an empty value as unknown; the optional extra rows stay quiet. -->
	<div
		class={[
			'flex min-h-14 items-center gap-2 rounded-input px-3',
			empty && core ? 'bg-warn-soft' : 'bg-surface2'
		]}
	>
		<label for={id} class="min-w-0 flex-1 text-[15px] font-semibold">
			{text}
			{#if empty && core}<span class="ml-1 text-[13px] font-semibold text-warn"
					>· {m.food_unknown()}</span
				>{/if}
			{#if bad}<span class="block text-[13px] text-bad">{m.food_invalid_number()}</span>{/if}
		</label>
		<label class="flex min-h-11 items-center gap-1.5 text-[15px] font-semibold text-muted">
			<input type="checkbox" bind:checked={value.lessThan} />
			<span aria-hidden="true">&lt;</span><span class="sr-only">{m.food_less_than()}</span>
		</label>
		<input
			{id}
			bind:value={value.text}
			inputmode="decimal"
			autocomplete="off"
			aria-invalid={bad}
			class="h-11 w-24 rounded-small border border-line bg-surface px-2 text-right text-[16px] font-semibold tabular-nums"
		/>
	</div>
{/snippet}

<form class="flex flex-col gap-4" onsubmit={submit} novalidate>
	<TextField label={m.food_name()} bind:value={name} required maxlength={200} />
	<TextField label={m.food_brand()} bind:value={brand} maxlength={120} />
	<div class="flex items-center gap-3">
		<FoodIcon {icon} name={name || '-'} {brand} />
		<span class="flex min-w-0 flex-1 flex-col">
			<span class="text-[13px] font-[650] text-muted">{m.icon_label()}</span>
			<span class="text-[14px]">{icon ? m.icon_chosen() : m.icon_suggested()}</span>
		</span>
		<button
			type="button"
			onclick={() => (choosingIcon = true)}
			class="min-h-11 rounded-input px-3 text-[15px] font-semibold text-accent"
			>{m.icon_change()}</button
		>
	</div>

	<fieldset class="flex flex-col gap-2">
		<legend class="mb-1.5 text-[13px] font-[650] text-muted">{m.food_visibility()}</legend>
		<div class="grid grid-cols-2 gap-2">
			<button
				type="button"
				class={chip(visibility === 'shared')}
				aria-pressed={visibility === 'shared'}
				onclick={() => (visibility = 'shared')}>{m.food_visibility_shared()}</button
			>
			<button
				type="button"
				class={chip(visibility === 'private')}
				aria-pressed={visibility === 'private'}
				onclick={() => (visibility = 'private')}>{m.food_visibility_private()}</button
			>
		</div>
	</fieldset>

	<fieldset class="flex flex-col gap-2">
		<legend class="mb-1.5 text-[13px] font-[650] text-muted">{m.food_basis()}</legend>
		<div class="grid grid-cols-3 gap-2">
			{#each [['100g', m.food_basis_100g()], ['100ml', m.food_basis_100ml()], ['serving', m.food_basis_serving()]] as const as [value, text] (value)}
				<button
					type="button"
					class={chip(basis === value)}
					aria-pressed={basis === value}
					onclick={() => (basis = value)}>{text}</button
				>
			{/each}
		</div>
	</fieldset>

	{#if basis === 'serving'}
		<TextField
			label={m.food_serving_label()}
			placeholder={m.food_serving_label_placeholder()}
			bind:value={servingLabel}
			maxlength={60}
			aria-invalid={showErrors && !servingLabel.trim()}
		/>
		<div class="flex items-end gap-2">
			<div class="flex-1">
				<TextField
					label={m.food_serving_size()}
					hint={m.food_serving_size_hint()}
					bind:value={servingSizeText}
					inputmode="decimal"
					aria-invalid={invalid(servingSizeText)}
				/>
			</div>
			<Select
				bind:value={servingSizeUnit}
				aria-label={m.food_unit()}
				options={UNITS}
				class="mb-[26px]"
			/>
		</div>
	{/if}

	<fieldset class="flex flex-col gap-2">
		<legend class="mb-1.5 text-[13px] font-[650] text-muted">{m.food_label_type()}</legend>
		<div class="grid grid-cols-2 gap-2">
			<button
				type="button"
				class={chip(labelType === 'eu')}
				aria-pressed={labelType === 'eu'}
				onclick={() => (labelType = 'eu')}>{m.food_label_eu()}</button
			>
			<button
				type="button"
				class={chip(labelType === 'us')}
				aria-pressed={labelType === 'us'}
				onclick={() => (labelType = 'us')}>{m.food_label_us()}</button
			>
		</div>
	</fieldset>

	<section class="flex flex-col gap-2" aria-labelledby="values-heading">
		<h2 id="values-heading" class="text-[17px] font-bold">{m.food_values()}</h2>
		<p class="text-[13px] text-muted">{m.food_values_hint()}</p>
		{#each FIELDS as field (field)}
			{@render row(`n-${field}`, label(field), rows[field], true)}
		{/each}
		<details class="group flex flex-col" open={extrasOpen}>
			<summary
				class="flex min-h-11 cursor-pointer items-center gap-2 text-[15px] font-semibold text-accent"
			>
				<ChevronRight
					size={18}
					aria-hidden="true"
					class="transition-transform group-open:rotate-90 motion-reduce:transition-none"
				/>{m.food_more_nutrients()}
			</summary>
			<div class="mt-1 flex flex-col gap-2">
				{#each EXTRA_CODES as code (code)}
					{@render row(`n-${code}`, extraLabel[code](), extras[code], false)}
				{/each}
			</div>
		</details>
	</section>

	{#each warnings as w (w)}<Notice>{warningText[w]()}</Notice>{/each}

	<section class="flex flex-col gap-2" aria-labelledby="portions-heading">
		<h2 id="portions-heading" class="text-[17px] font-bold">{m.food_portions()}</h2>
		<p class="text-[13px] text-muted">{m.food_portions_hint()}</p>
		{#each portions as portion, i (i)}
			<!-- Phone: the name on its own line, amount and unit below; desktop: one row. Remove sits in the name's label
			     row, at the right (owner, 2026-10-31), not beside the unit. -->
			<div
				class={[
					'grid grid-cols-[minmax(0,1fr)_auto] items-end gap-2 desk:grid-cols-[minmax(0,1fr)_6rem_auto]',
					i > 0 && 'mt-2 border-t border-line pt-4 desk:mt-0 desk:border-0 desk:pt-1'
				]}
			>
				<div class="relative col-span-2 min-w-0 desk:col-span-1">
					<TextField
						id="portion-name-{i}"
						label={m.food_portion_name()}
						bind:value={portion.name}
						maxlength={60}
					/>
					<button
						type="button"
						class="absolute -top-3 right-0 min-h-11 px-1 text-[13px] font-semibold text-bad"
						aria-label={m.food_portion_remove()}
						onclick={() => portions.splice(i, 1)}>{m.food_portion_remove_short()}</button
					>
				</div>
				<div class="min-w-0">
					<TextField
						id="portion-amount-{i}"
						label={m.food_portion_amount()}
						bind:value={portion.text}
						inputmode="decimal"
					/>
				</div>
				<Select bind:value={portion.unit} label={m.food_unit()} options={UNITS} />
			</div>
		{/each}
		<Button
			variant="ghost"
			onclick={() => portions.push({ name: '', text: '', unit: basis === '100ml' ? 'ml' : 'g' })}
			>{m.food_portion_add()}</Button
		>
	</section>

	<Button type="submit" wide disabled={busy || !name.trim()}
		>{busy ? m.common_working() : (saveLabel ?? m.food_save())}</Button
	>
</form>

{#if choosingIcon}
	<IconPicker
		{suggested}
		chosen={icon}
		onchoose={(hex) => {
			icon = hex;
			choosingIcon = false;
		}}
		onclose={() => (choosingIcon = false)}
	/>
{/if}
