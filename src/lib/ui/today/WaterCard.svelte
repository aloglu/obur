<script lang="ts">
	// docs/ui.md "Water and weight": +250 / +500 ml buttons and any other amount (ml or l); each addition can be undone
	// from the toast.
	import Check from '@lucide/svelte/icons/check';
	import { m } from '#lib/paraglide/messages.js';
	import { api } from '#lib/client/api.ts';
	import { offline, submit } from '#lib/client/offline/sync.svelte.ts';
	import { deviceZone } from '#lib/client/prefs.ts';
	import { showToast } from '#lib/client/toast.svelte.ts';
	import { parseWaterMl, type BodyReading } from '#lib/shared/body-types.ts';
	import { dayTitle } from '#lib/shared/format.ts';
	import { formatDecimal } from '#lib/shared/numbers.ts';
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
	let other = $state(false);
	let amount = $state('');
	let amountError = $state('');
	let unit = $state<'ml' | 'l'>('ml');

	function close() {
		other = false;
		amount = '';
		amountError = '';
		unit = 'ml';
	}
	const pendingMl = $derived(
		offline.items.reduce(
			(sum, i) =>
				i.status === 'pending' && i.preview.kind === 'water' && i.preview.localDate === date
					? sum + i.preview.ml
					: sum,
			0
		)
	);

	async function addOther(event: SubmitEvent) {
		event.preventDefault();
		const ml = parseWaterMl(amount, unit);
		if (ml === undefined) {
			amountError = m.water_other_invalid();
			return;
		}
		amountError = '';
		if (await add(ml)) close();
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
	class="flex flex-col gap-3 rounded-card bg-surface p-[18px] shadow-card"
	aria-labelledby="water-title"
>
	<div class="flex items-center justify-between gap-2">
		<h2 id="water-title" class="text-[19px] font-bold">{m.water_title()}</h2>
		{#if entries.length > 0}
			<button
				type="button"
				onclick={() => (editing = true)}
				aria-label={m.water_edit_label()}
				class="-my-2 -mr-2 min-h-11 rounded-input px-2 text-[14px] font-semibold text-accent"
				>{m.water_edit()}</button
			>
		{/if}
	</div>
	<p class="font-display text-[28px] leading-none font-extrabold tabular-nums">
		{m.water_total({ ml: formatDecimal(totalMl, ',', 0) })}
	</p>
	{#if pendingMl}
		<p class="text-[13px] font-semibold text-warn">
			{m.offline_water_pending({ ml: String(pendingMl) })}
		</p>
	{/if}
	<!-- Quick amounts share the first row; the second is "Other amount", which turns into a field in place with a
	     tappable ml / l suffix (owner review 2026-10-30). -->
	<div class="grid grid-cols-2 gap-2">
		{#each [250, 500] as ml (ml)}
			<button
				type="button"
				disabled={busy}
				onclick={() => add(ml)}
				aria-label={m.water_add_label({ ml: String(ml) })}
				class="min-h-11 rounded-full bg-soft px-2 text-[15px] font-bold whitespace-nowrap text-accent disabled:opacity-50"
				>{m.water_add({ ml: String(ml) })}</button
			>
		{/each}
	</div>
	{#if other}
		<form class="flex flex-col gap-1" onsubmit={addOther} novalidate>
			<div
				class={[
					'flex min-h-11 items-center rounded-full border bg-surface2 pl-4',
					amountError ? 'border-bad' : 'border-line focus-within:border-accent'
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
						if (e.key === 'Escape') close();
					}}
					class="min-w-0 flex-1 bg-transparent text-[16px] font-semibold tabular-nums outline-none"
				/>
				<button
					type="button"
					onclick={() => (unit = unit === 'ml' ? 'l' : 'ml')}
					aria-label={unit === 'ml' ? m.water_unit_ml() : m.water_unit_l()}
					class="min-h-11 min-w-11 px-2 text-[15px] font-bold text-accent underline decoration-dotted underline-offset-4"
					>{unit}</button
				>
				<button
					type="submit"
					disabled={busy}
					aria-label={m.water_other_add()}
					class="grid size-11 place-items-center disabled:opacity-50"
				>
					<span class="grid size-9 place-items-center rounded-full bg-accent text-on-accent"
						><Check size={20} aria-hidden="true" /></span
					>
				</button>
			</div>
			{#if amountError}
				<p id="water-amount-error" class="px-1 text-[13px] font-semibold text-bad">{amountError}</p>
			{/if}
		</form>
	{:else}
		<button
			type="button"
			disabled={busy}
			onclick={() => (other = true)}
			class="min-h-11 rounded-full bg-surface2 px-2 text-[15px] font-bold text-text disabled:opacity-50"
			>{m.water_other()}</button
		>
	{/if}
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
