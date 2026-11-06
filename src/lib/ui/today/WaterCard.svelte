<script lang="ts">
	// docs/ui.md "Water and Weight": four rows lined up with Weight's (it sits in the parent's grid): title, amount,
	// quick amounts, Other amount, which opens in place as a field with a tappable ml / l.
	import Check from '@lucide/svelte/icons/check';
	import { page } from '$app/state';
	import { m } from '#lib/paraglide/messages.js';
	import { api } from '#lib/client/api.ts';
	import { inlineField } from '#lib/client/inline-field.svelte.ts';
	import { offline, submit } from '#lib/client/offline/sync.svelte.ts';
	import { clockTime, deviceZone } from '#lib/client/prefs.ts';
	import { showToast } from '#lib/client/toast.svelte.ts';
	import { parseWaterMl, type BodyReading } from '#lib/shared/body-types.ts';
	import { dayTitle } from '#lib/shared/format.ts';
	import { formatDecimal } from '#lib/shared/numbers.ts';
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

	$effect(() => {
		if (other) return;
		amount = '';
		amountError = '';
		unit = 'ml';
	});

	const pendingMl = $derived(
		offline.items.reduce(
			(sum, i) =>
				i.status === 'pending' && i.preview.kind === 'water' && i.preview.localDate === date
					? sum + i.preview.ml
					: sum,
			0
		)
	);
	const lastAdded = $derived(entries.at(-1)?.createdAt);

	async function addOther(event: SubmitEvent) {
		event.preventDefault();
		const ml = parseWaterMl(amount, unit);
		if (ml === undefined) {
			amountError = m.water_other_invalid();
			return;
		}
		amountError = '';
		if (await add(ml)) inlineField.open = null;
	}

	/** True once saved or queued. */
	async function add(ml: number): Promise<boolean> {
		busy = true;
		try {
			const result = await submit<{ id: string }>(
				'/api/v1/body/water',
				{ id: crypto.randomUUID(), date, zone: deviceZone(), value: ml },
				{ kind: 'water', localDate: date, ml }
			);
			if (result.status === 'queued') {
				showToast({ message: m.offline_saved(), detail: m.offline_saved_detail() });
				return true;
			}
			const r = result.data;
			await onchange();
			showToast({
				message: m.toast_water({ ml: String(ml) }),
				undo: async () => {
					await api('POST', `/api/v1/body/water/${r.id}?action=delete`, {});
					await onchange();
				}
			});
			return true;
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
		<h2 id="water-title" class="text-[15px] font-bold">{m.water_title()}</h2>
		{#if entries.length > 0}
			<button
				type="button"
				onclick={() => (editing = true)}
				aria-label={m.water_edit_label()}
				class="-mr-1.5 min-h-11 px-1.5 text-[14px] font-[650] text-accent">{m.water_edit()}</button
			>
		{/if}
	</div>
	<div class="mt-2.5 flex flex-col gap-[3px]">
		<p class="font-display text-[26px] leading-[1.1] font-[750] tracking-[-0.02em] tabular-nums">
			<Roll value={formatDecimal(totalMl, ',', 0)} />
			<small class="font-sans text-[13px] font-semibold tracking-normal text-muted">ml</small>
		</p>
		<p class="text-[13px] leading-[1.3] text-muted">
			{#if pendingMl}
				<span class="font-semibold text-warn"
					>{m.offline_water_pending({ ml: String(pendingMl) })}</span
				>
			{:else if lastAdded}
				{m.water_last_added({ time: clockTime(lastAdded, page.data.timeFormat ?? 'device') })}
			{:else}
				{m.water_nothing()}
			{/if}
		</p>
	</div>
	<div class="mt-3.5 grid grid-cols-2 gap-1.5">
		{#each [250, 500] as ml (ml)}
			<button
				type="button"
				disabled={busy}
				onclick={() => add(ml)}
				aria-label={m.water_add_label({ ml: String(ml) })}
				class="min-h-12 rounded-input bg-surface2 text-[15px] font-bold whitespace-nowrap transition-transform active:scale-[0.97] disabled:opacity-50"
				>+{ml}</button
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
						placeholder={m.water_other_placeholder()}
						aria-invalid={amountError ? 'true' : undefined}
						aria-describedby={amountError ? 'water-amount-error' : undefined}
						onkeydown={(e) => {
							if (e.key === 'Escape') inlineField.open = null;
						}}
						class="w-0 min-w-0 flex-1 bg-transparent text-[16px] font-semibold tabular-nums outline-none placeholder:font-medium placeholder:text-muted"
					/>
					<button
						type="button"
						onclick={() => (unit = unit === 'ml' ? 'l' : 'ml')}
						aria-label={unit === 'ml' ? m.water_unit_ml() : m.water_unit_l()}
						class="h-10 shrink-0 px-1 text-[14px] font-[650] text-muted">{unit}</button
					>
					<button
						type="submit"
						disabled={busy}
						aria-label={m.water_other_add()}
						class="grid size-10 shrink-0 place-items-center rounded-small bg-fill text-on-accent disabled:opacity-50"
						><Check size={18} aria-hidden="true" /></button
					>
				</div>
				{#if amountError}
					<p id="water-amount-error" class="mt-1 px-1 text-[13px] font-semibold text-bad">
						{amountError}
					</p>
				{/if}
			</form>
		{:else}
			<button
				type="button"
				disabled={busy}
				onclick={() => (inlineField.open = 'water')}
				class="min-h-12 rounded-input bg-surface2 text-[15px] font-bold transition-transform active:scale-[0.97] disabled:opacity-50"
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
