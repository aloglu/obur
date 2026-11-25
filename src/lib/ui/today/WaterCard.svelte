<script lang="ts">
	// docs/ui.md "Water and Weight": four rows lined up with Weight's (it sits in the parent's grid): title, amount,
	// quick amounts, Other amount, which opens in place as a field with a tappable ml / l. In US fluid ounces (Units)
	// the amounts are 8 and 16 fl oz and the field takes fluid ounces; water is stored in millilitres either way.
	import Check from '@lucide/svelte/icons/check';
	import { page } from '$app/state';
	import { m } from '#lib/paraglide/messages.js';
	import { api, NoConnection, recordIds, save } from '#lib/client/api.ts';
	import { inlineField } from '#lib/client/inline-field.svelte.ts';
	import { clockTime, deviceZone } from '#lib/client/prefs.ts';
	import { showToast } from '#lib/client/toast.svelte.ts';
	import { parseWaterMl, type BodyReading } from '#lib/shared/body-types.ts';
	import { dayTitle } from '#lib/shared/format.ts';
	import { formatDecimal, parseDecimal } from '#lib/shared/numbers.ts';
	import { fromMl, toMl, waterSymbol, waterText } from '#lib/shared/body-units.ts';
	import { waterUnit } from '#lib/client/units.ts';
	import Roll from '../Roll.svelte';
	import ReadingsSheet from './ReadingsSheet.svelte';

	interface Props {
		date: string;
		today: string;
		entries: BodyReading[];
		totalMl: number;
		onchange: () => Promise<void>;
	}
	let { date, today, entries, totalMl, onchange }: Props = $props();
	let busy = $state(false);
	let editing = $state(false);
	let amount = $state('');
	let amountError = $state('');
	let unit = $state<'ml' | 'l'>('ml');
	const other = $derived(inlineField.open === 'water');
	const wu = $derived(waterUnit());
	/** The quick amounts, in the person's unit. */
	const quick = $derived(wu === 'floz' ? [8, 16] : [250, 500]);

	/** A typed amount in millilitres: fluid ounces, or ml and l as parseWaterMl reads them. */
	function typedMl(text: string): number | undefined {
		if (wu === 'ml') return parseWaterMl(text, unit);
		const n = parseDecimal(text);
		if (n === undefined || n === null) return undefined;
		const ml = toMl(n, 'floz');
		return ml >= 1 && ml <= 10_000 ? ml : undefined;
	}

	$effect(() => {
		if (other) return;
		amount = '';
		amountError = '';
		unit = 'ml';
	});

	const lastAdded = $derived(entries.at(-1)?.createdAt);

	async function addOther(event: SubmitEvent) {
		event.preventDefault();
		// Empty, the check closes the field, like a tap elsewhere.
		if (amount.trim() === '') {
			inlineField.open = null;
			return;
		}
		const ml = typedMl(amount);
		if (ml === undefined) {
			amountError = wu === 'floz' ? m.water_other_invalid_floz() : m.water_other_invalid();
			return;
		}
		amountError = '';
		if (await add(ml)) inlineField.open = null;
	}

	// A tap again after a lost answer resends the same glass; a glass after a saved one is a new one.
	const idFor = recordIds();

	/** True once saved. */
	async function add(ml: number): Promise<boolean> {
		busy = true;
		try {
			const water = { date, zone: deviceZone(), value: ml };
			const r = await save<{ id: string }>('/api/v1/body/water', { id: idFor(water), ...water });
			idFor.saved();
			await onchange();
			showToast({
				message: m.toast_water({ amount: waterText(ml, wu) }),
				undo: async () => {
					await api('POST', `/api/v1/body/water/${r.id}?action=delete`, {});
					await onchange();
				}
			});
			return true;
		} catch (e) {
			showToast({
				message: e instanceof NoConnection ? m.save_no_connection() : m.error_generic()
			});
			return false;
		} finally {
			busy = false;
		}
	}
</script>

<section
	class="row-span-4 grid grid-rows-subgrid gap-y-0 rounded-card bg-surface px-3.5 pt-4 pb-[18px] shadow-card desk:px-[18px]"
	aria-labelledby="water-title"
>
	<div class="flex h-6 items-center justify-between gap-2">
		<h2 id="water-title" class="text-[0.9375rem] font-bold">{m.water_title()}</h2>
		{#if entries.length > 0}
			<button
				type="button"
				onclick={() => (editing = true)}
				aria-label={m.water_edit_label()}
				class="-mr-1.5 min-h-11 px-1.5 text-[0.875rem] font-[650] text-accent"
				>{m.water_edit()}</button
			>
		{/if}
	</div>
	<div class="mt-2.5 flex flex-col gap-[3px]">
		<p
			class="font-display text-[1.625rem] leading-[1.1] font-[750] tracking-[-0.02em] tabular-nums"
		>
			<Roll value={formatDecimal(fromMl(totalMl, wu), 0)} />
			<small class="font-sans text-[0.8125rem] font-semibold tracking-normal text-muted"
				>{waterSymbol(wu)}</small
			>
		</p>
		<p class="text-[0.8125rem] leading-[1.3] text-muted">
			{#if lastAdded}
				{m.water_last_added({ time: clockTime(lastAdded, page.data.timeFormat ?? 'device') })}
			{:else}
				{m.water_nothing()}
			{/if}
		</p>
	</div>
	<div class="mt-3.5 grid grid-cols-2 gap-1.5">
		{#each quick as n (n)}
			<button
				type="button"
				disabled={busy}
				onclick={() => add(toMl(n, wu))}
				aria-label={m.water_add_label({ amount: `${n} ${waterSymbol(wu)}` })}
				class="min-h-12 rounded-input bg-surface2 text-[0.9375rem] font-bold whitespace-nowrap transition-transform active:scale-[0.97] disabled:opacity-50"
				>+{n}</button
			>
		{/each}
	</div>
	<div class="mt-1.5 grid">
		{#if other}
			<form onsubmit={addOther} novalidate class="field-swap">
				<div
					class={[
						'flex h-12 items-center gap-0.5 rounded-input bg-surface2 py-1 pr-1 pl-3 ring-1',
						amountError ? 'ring-bad' : 'ring-transparent focus-within:ring-accent'
					]}
				>
					<!-- svelte-ignore a11y_autofocus -->
					<input
						id="water-amount"
						bind:value={amount}
						autofocus
						inputmode="decimal"
						autocomplete="off"
						aria-label={m.water_other_label()}
						placeholder={wu === 'floz'
							? m.water_other_placeholder_floz()
							: m.water_other_placeholder()}
						aria-invalid={amountError ? 'true' : undefined}
						aria-describedby={amountError ? 'water-amount-error' : undefined}
						onkeydown={(e) => {
							if (e.key === 'Escape') inlineField.open = null;
						}}
						class="w-0 min-w-0 flex-1 bg-transparent text-[1rem] font-semibold tabular-nums outline-none placeholder:font-medium placeholder:text-muted"
					/>
					{#if wu === 'floz'}
						<span class="shrink-0 px-1 text-[0.875rem] font-[650] whitespace-nowrap text-muted"
							>fl oz</span
						>
					{:else}
						<button
							type="button"
							onclick={() => (unit = unit === 'ml' ? 'l' : 'ml')}
							aria-label={unit === 'ml' ? m.water_unit_ml() : m.water_unit_l()}
							class="h-10 shrink-0 px-1 text-[0.875rem] font-[650] text-muted">{unit}</button
						>
					{/if}
					<button
						type="submit"
						disabled={busy}
						aria-label={m.water_other_add()}
						class="grid size-10 shrink-0 place-items-center rounded-small bg-fill text-on-accent disabled:opacity-50"
						><Check size={18} aria-hidden="true" /></button
					>
				</div>
				{#if amountError}
					<p id="water-amount-error" class="mt-1 px-1 text-[0.8125rem] font-semibold text-bad">
						{amountError}
					</p>
				{/if}
			</form>
		{:else}
			<button
				type="button"
				disabled={busy}
				onclick={() => (inlineField.open = 'water')}
				class="min-h-12 rounded-input bg-surface2 text-[0.9375rem] font-bold transition-transform active:scale-[0.97] disabled:opacity-50"
				>{m.water_other()}</button
			>
		{/if}
	</div>
</section>

{#if editing}
	<ReadingsSheet
		kind="water"
		title={m.water_sheet_title({ day: dayTitle(date, today) })}
		readings={entries.toReversed()}
		{today}
		{onchange}
		onclose={() => (editing = false)}
	/>
{/if}
