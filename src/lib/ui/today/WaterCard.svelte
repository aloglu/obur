<script lang="ts">
	// docs/ui.md "Water and weight": +250 / +500 ml buttons and any other amount (ml or l); each addition can be undone
	// from the toast.
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
		const ml = parseWaterMl(amount);
		if (ml === undefined) {
			amountError = m.water_other_invalid();
			return;
		}
		amountError = '';
		if (await add(ml)) {
			amount = '';
			other = false;
		}
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
	<div class="flex gap-2">
		{#each [250, 500] as ml (ml)}
			<button
				type="button"
				disabled={busy}
				onclick={() => add(ml)}
				aria-label={m.water_add_label({ ml: String(ml) })}
				class="inline-flex min-h-11 flex-1 items-center justify-center rounded-full bg-soft px-2 text-[15px] font-bold whitespace-nowrap text-accent disabled:opacity-50"
				>{m.water_add({ ml: String(ml) })}</button
			>
		{/each}
		<button
			type="button"
			disabled={busy}
			aria-expanded={other}
			onclick={() => (other = !other)}
			class="inline-flex min-h-11 flex-1 items-center justify-center rounded-full bg-surface2 px-2 text-[15px] font-bold whitespace-nowrap text-text disabled:opacity-50"
			>{m.water_other()}</button
		>
	</div>
	{#if other}
		<form class="flex flex-col gap-1" onsubmit={addOther} novalidate>
			<label for="water-amount" class="text-[13px] font-semibold text-muted"
				>{m.water_other_label()}</label
			>
			<div class="flex gap-2">
				<!-- svelte-ignore a11y_autofocus -->
				<input
					id="water-amount"
					bind:value={amount}
					autofocus
					inputmode="decimal"
					autocomplete="off"
					placeholder={m.water_other_placeholder()}
					aria-invalid={amountError ? 'true' : undefined}
					aria-describedby={amountError ? 'water-amount-error' : undefined}
					class="min-h-11 min-w-0 flex-1 rounded-input border border-line bg-surface px-3 text-[16px]"
				/>
				<button
					type="submit"
					disabled={busy}
					class="min-h-11 rounded-input bg-accent px-4 text-[15px] font-bold text-on-accent disabled:opacity-50"
					>{m.water_other_add()}</button
				>
			</div>
			{#if amountError}
				<p id="water-amount-error" class="text-[13px] font-semibold text-bad">{amountError}</p>
			{/if}
		</form>
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
