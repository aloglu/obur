<script lang="ts">
	// Create or edit a food, and check a scanned label (docs/ui.md, "Food form"): one card each for the name, the values,
	// the portions and who can find it. An empty value shows as Unknown, never as zero. `actions` go above Save.
	import ChevronDown from '@lucide/svelte/icons/chevron-down';
	import Plus from '@lucide/svelte/icons/plus';
	import { untrack, type Snippet } from 'svelte';
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
	import Chips from '../Chips.svelte';
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
		/** Values that aren't saved yet, such as a scanned label: Save is on from the start. */
		unsaved?: boolean;
		/** What else can be done with the food, above Save. */
		actions?: Snippet;
		/** A short line under Save. */
		note?: string;
		/** In place of the hint on copying a label: what a label scan read and decided. */
		valueNotes?: Snippet;
		/** On the right of the Nutrition title: Scan label on New food (docs/ui.md, "Food form"). */
		valuesAction?: Snippet;
		/** The hint on copying a label, when it should say more (that a scan can fill it in). */
		valuesHint?: string;
		/** Under the Nutrition title, above the basis: the scanned photo on New food. */
		valuesTop?: Snippet;
	}

	const UNITS: { value: 'g' | 'ml'; label: string }[] = [
		{ value: 'g', label: 'g' },
		{ value: 'ml', label: 'ml' }
	];
	let {
		initial,
		busy = false,
		onsave,
		startName = '',
		saveLabel,
		unsaved = false,
		actions,
		note,
		valueNotes,
		valuesAction,
		valuesHint,
		valuesTop
	}: Props = $props();
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

	const reportedIn = (nutrients: NutrientValue[], code: NutrientCode) =>
		nutrients.find(
			(n) => n.code === code && (n.qualifier === 'reported' || n.qualifier === 'less_than')
		);

	const reported = (code: NutrientCode) => reportedIn(start?.nutrients ?? [], code);
	const labelTypeOf = (nutrients: NutrientValue[]) =>
		reportedIn(nutrients, 'carbohydrate_total') || reportedIn(nutrients, 'sodium') ? 'us' : 'eu';

	let labelType = $state<'eu' | 'us'>(labelTypeOf(start?.nutrients ?? []));
	const codeFor = (field: Field): NutrientCode =>
		field === 'carbohydrate'
			? labelType === 'eu'
				? 'carbohydrate_excl_fibre'
				: 'carbohydrate_total'
			: field === 'salt' && labelType === 'us'
				? 'sodium'
				: field;

	function initialRow(
		field: Field,
		find: (code: NutrientCode) => NutrientValue | undefined = reported
	) {
		const codes: NutrientCode[] =
			field === 'carbohydrate'
				? ['carbohydrate_excl_fibre', 'carbohydrate_total']
				: field === 'salt'
					? ['salt', 'sodium']
					: [field];
		const found = codes.map(find).find(Boolean);
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
	const extraRows = (find: (code: NutrientCode) => NutrientValue | undefined) =>
		Object.fromEntries(
			EXTRA_CODES.map((code) => {
				const found = find(code);
				return [
					code,
					{
						text: found ? formatDecimal(found.value, ',', 4) : '',
						lessThan: found?.qualifier === 'less_than'
					}
				];
			})
		) as Record<Extra, { text: string; lessThan: boolean }>;
	let extras = $state(extraRows(reported));
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

	// Save waits for a change when editing a saved food.
	const formState = () =>
		JSON.stringify({
			name,
			brand,
			icon,
			visibility,
			basis,
			servingLabel,
			servingSizeText,
			servingSizeUnit,
			labelType,
			rows,
			extras,
			portions
		});
	const startState = formState();
	const dirty = $derived(formState() !== startState);
	let extrasShown = $state(extrasOpen);

	/** Whether any value of the Nutrition card has been typed, so filling it from a label would replace something. */
	export function hasValues() {
		return (
			FIELDS.some((f) => rows[f].text.trim() !== '') ||
			EXTRA_CODES.some((c) => extras[c].text.trim() !== '') ||
			servingLabel.trim() !== '' ||
			servingSizeText.trim() !== ''
		);
	}

	/**
	 * Replaces the Nutrition card with what a label scan read (New food's Scan label). The name, brand, icon,
	 * portions and who can find it stay as typed.
	 */
	export function fillValues(
		food: Pick<FoodDetail, 'basis' | 'servingLabel' | 'servingSize' | 'nutrients'>
	) {
		const find = (code: NutrientCode) => reportedIn(food.nutrients, code);
		labelType = labelTypeOf(food.nutrients);
		basis = food.basis;
		servingLabel = food.servingLabel ?? '';
		servingSizeText = food.servingSize ? formatDecimal(food.servingSize.amount, ',', 4) : '';
		servingSizeUnit = food.servingSize?.unit ?? 'g';
		rows = Object.fromEntries(FIELDS.map((f) => [f, initialRow(f, find)])) as typeof rows;
		extras = extraRows(find);
		if (EXTRA_CODES.some((c) => extras[c].text !== '')) extrasShown = true;
	}

	/** "Fat (g)" as its name and unit, for a row's two columns. */
	const parts = (text: string) => {
		const [, name, unit] = text.match(/^(.*) \((.*)\)$/) ?? [undefined, text, ''];
		return { name, unit };
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
</script>

{#snippet row(
	id: string,
	text: string,
	value: { text: string; lessThan: boolean },
	core: boolean,
	bound: boolean,
	sub = false
)}
	{@const bad = invalid(value.text)}
	{@const { name: rowName, unit } = parts(text)}
	<div
		class="grid min-h-[52px] grid-cols-[minmax(0,1fr)_36px_88px_34px] items-center gap-2 border-line not-first:border-t large:grid-cols-[36px_minmax(0,1fr)_auto] large:py-2"
	>
		<label
			for={id}
			class={[
				sub ? 'pl-3.5 text-[0.875rem] text-muted' : 'text-[0.9375rem] font-[550]',
				'large:col-span-3'
			]}
		>
			{rowName}<span class="sr-only"> {unit}</span>
			{#if bad}<span class="block text-[0.8125rem] font-semibold text-bad"
					>{m.food_invalid_number()}</span
				>{/if}
		</label>
		{#if bound}
			<button
				type="button"
				aria-pressed={value.lessThan}
				aria-label={m.food_less_than_of({ name: rowName })}
				onclick={() => (value.lessThan = !value.lessThan)}
				class={[
					'size-9 rounded-[10px] text-[0.9375rem] font-[750]',
					value.lessThan ? 'bg-soft text-accent' : 'bg-surface2 text-muted'
				]}>&lt;</button
			>
		{:else}<span></span>{/if}
		<input
			{id}
			bind:value={value.text}
			inputmode="decimal"
			autocomplete="off"
			placeholder={core ? m.food_unknown() : '–'}
			aria-invalid={bad}
			class="h-10 w-[88px] rounded-[10px] border border-line bg-surface2 px-2.5 text-right text-[1rem] font-[650] tabular-nums placeholder:text-[0.875rem] placeholder:font-medium placeholder:text-muted focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-accent aria-invalid:border-bad large:h-auto large:min-h-10 large:w-full"
		/>
		<span class="text-[0.8125rem] text-muted">{unit}</span>
	</div>
{/snippet}

<form class="flex flex-col gap-3" onsubmit={submit} novalidate>
	<section class="flex flex-col gap-3 rounded-card bg-surface p-[18px] shadow-card">
		<TextField
			label={m.food_name()}
			bind:value={name}
			required
			maxlength={200}
			autocapitalize="words"
		/>
		<TextField label={m.food_brand()} bind:value={brand} maxlength={120} autocapitalize="words" />
		<div class="flex items-center gap-3">
			<FoodIcon {icon} name={name || '-'} {brand} />
			<span class="flex min-w-0 flex-1 flex-col">
				<span class="text-[0.9375rem] font-semibold">{m.icon_label()}</span>
				<span class="text-[0.8125rem] text-muted"
					>{icon ? m.icon_chosen() : m.icon_suggested()}</span
				>
			</span>
			<button
				type="button"
				onclick={() => (choosingIcon = true)}
				class="min-h-11 rounded-input px-3 text-[0.9375rem] font-semibold text-accent"
				>{m.icon_change()}</button
			>
		</div>
	</section>

	<section
		class="flex flex-col gap-3 rounded-card bg-surface p-[18px] shadow-card"
		aria-labelledby="values-heading"
	>
		<!-- At large text sizes the action wraps under the title rather than pushing the page sideways. -->
		<div class="-my-1 flex min-h-11 flex-wrap items-center justify-between gap-x-2">
			<h2 id="values-heading" class="text-[1.1875rem] font-bold">{m.food_values()}</h2>
			{#if valuesAction}<div class="-mr-1.5 shrink-0">{@render valuesAction()}</div>{/if}
		</div>
		{#if valuesTop}{@render valuesTop()}{/if}
		<Chips
			label={m.food_basis()}
			bind:value={basis}
			options={[
				{ value: '100g', label: m.food_basis_100g() },
				{ value: '100ml', label: m.food_basis_100ml() },
				{ value: 'serving', label: m.food_basis_serving() }
			]}
		/>
		{#if basis === 'serving'}
			<TextField
				label={m.food_serving_label()}
				placeholder={m.food_serving_label_placeholder()}
				bind:value={servingLabel}
				maxlength={60}
				aria-invalid={showErrors && !servingLabel.trim()}
			/>
			<div class="flex flex-col gap-1.5">
				<div class="flex items-end gap-2">
					<div class="min-w-0 flex-1">
						<TextField
							label={m.food_serving_size()}
							bind:value={servingSizeText}
							inputmode="decimal"
							aria-describedby="food-serving-size-hint"
							aria-invalid={invalid(servingSizeText)}
						/>
					</div>
					<Select bind:value={servingSizeUnit} aria-label={m.food_unit()} options={UNITS} />
				</div>
				<p id="food-serving-size-hint" class="text-[0.8125rem] text-muted">
					{m.food_serving_size_hint()}
				</p>
			</div>
		{/if}
		<Chips
			label={m.food_label_type()}
			bind:value={labelType}
			options={[
				{ value: 'eu', label: m.food_label_eu() },
				{ value: 'us', label: m.food_label_us() }
			]}
		/>
		{#if valueNotes}{@render valueNotes()}{:else}
			<p class="text-[0.8125rem] text-muted">{valuesHint ?? m.food_values_hint()}</p>
		{/if}
		<div class="flex flex-col">
			{#each FIELDS as field (field)}
				{@render row(
					`n-${field}`,
					label(field),
					rows[field],
					field !== 'energy_kj',
					field !== 'energy_kcal' && field !== 'energy_kj',
					field === 'saturated_fat' || field === 'sugars'
				)}
			{/each}
		</div>
		<button
			type="button"
			aria-expanded={extrasShown}
			onclick={() => (extrasShown = !extrasShown)}
			class="flex min-h-11 items-center gap-1.5 self-start text-[0.9375rem] font-bold text-accent"
		>
			{m.food_more_nutrients()}
			<ChevronDown
				size={18}
				aria-hidden="true"
				class={['transition-transform duration-300', extrasShown && 'rotate-180']}
			/>
		</button>
		<div class={['collapse-row -mt-3', extrasShown && 'open']}>
			<div inert={!extrasShown}>
				<div class="flex flex-col pt-3">
					{#each EXTRA_CODES as code (code)}
						{@render row(`n-${code}`, extraLabel[code](), extras[code], false, true)}
					{/each}
				</div>
			</div>
		</div>
		{#each warnings as w (w)}<Notice>{warningText[w]()}</Notice>{/each}
	</section>

	<section
		class="flex flex-col rounded-card bg-surface p-[18px] shadow-card"
		aria-labelledby="portions-heading"
	>
		<h2 id="portions-heading" class="mb-1 text-[1.1875rem] font-bold">{m.food_portions()}</h2>
		{#each portions as portion, i (i)}
			<div class="flex flex-col gap-2 border-line py-3 not-first-of-type:border-t">
				<div class="relative">
					<TextField
						id="portion-name-{i}"
						label={m.food_portion_name()}
						placeholder={m.food_portion_placeholder()}
						bind:value={portion.name}
						maxlength={60}
					/>
					<button
						type="button"
						class="absolute -top-3 right-0 min-h-11 px-1 text-[0.84375rem] font-bold text-bad"
						aria-label={m.food_portion_remove()}
						onclick={() => portions.splice(i, 1)}>{m.food_portion_remove_short()}</button
					>
				</div>
				<div class="grid grid-cols-2 items-end gap-2">
					<TextField
						id="portion-amount-{i}"
						label={m.food_portion_amount()}
						bind:value={portion.text}
						inputmode="decimal"
					/>
					<Select bind:value={portion.unit} label={m.food_unit()} options={UNITS} />
				</div>
			</div>
		{:else}
			<p class="pt-1 pb-2 text-[0.8125rem] text-muted">{m.food_portions_none()}</p>
		{/each}
		<button
			type="button"
			onclick={() => portions.push({ name: '', text: '', unit: basis === '100ml' ? 'ml' : 'g' })}
			class="flex min-h-11 items-center gap-1.5 self-start text-[0.9375rem] font-bold text-accent"
		>
			<Plus size={18} aria-hidden="true" />{m.food_portion_add()}
		</button>
	</section>

	<section class="flex flex-col gap-3 rounded-card bg-surface p-[18px] shadow-card">
		<Chips
			label={m.food_visibility()}
			bind:value={visibility}
			options={[
				{ value: 'shared', label: m.food_visibility_shared() },
				{ value: 'private', label: m.food_visibility_private() }
			]}
		/>
		<p class="text-[0.8125rem] text-muted">
			{visibility === 'shared' ? m.food_share_note_shared() : m.food_share_note_private()}
		</p>
	</section>

	{@render actions?.()}

	<Button type="submit" wide disabled={busy || !name.trim() || (!!start && !unsaved && !dirty)}
		>{busy ? m.common_working() : (saveLabel ?? m.food_save())}</Button
	>
	{#if note}<p class="px-1 text-[0.8125rem] text-muted">{note}</p>{/if}
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
