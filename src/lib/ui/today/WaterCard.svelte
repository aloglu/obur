<script lang="ts">
	// docs/ui.md "Water and weight": +250 / +500 ml buttons; each addition can be undone from the toast.
	import Plus from '@lucide/svelte/icons/plus';
	import { m } from '#lib/paraglide/messages.js';
	import { api } from '#lib/client/api.ts';
	import { offline, submit } from '#lib/client/offline/sync.svelte.ts';
	import { deviceZone } from '#lib/client/prefs.ts';
	import { showToast } from '#lib/client/toast.svelte.ts';
	import type { BodyReading } from '#lib/shared/body-types.ts';
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
	const pendingMl = $derived(
		offline.items.reduce(
			(sum, i) =>
				i.status === 'pending' && i.preview.kind === 'water' && i.preview.localDate === date
					? sum + i.preview.ml
					: sum,
			0
		)
	);

	async function add(ml: number) {
		busy = true;
		try {
			const result = await submit<{ id: string }>(
				'/api/v1/body/water',
				{ id: crypto.randomUUID(), date, zone: deviceZone(), value: ml },
				{ kind: 'water', localDate: date, ml }
			);
			if (result.status === 'queued') {
				showToast({ message: m.offline_saved(), detail: m.offline_saved_detail() });
				return;
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
	<div class="flex flex-wrap gap-2">
		{#each [250, 500] as ml (ml)}
			<button
				type="button"
				disabled={busy}
				onclick={() => add(ml)}
				aria-label={m.water_add_label({ ml: String(ml) })}
				class="inline-flex min-h-11 flex-1 items-center justify-center gap-1 rounded-full bg-soft px-3 text-[15px] font-bold text-accent disabled:opacity-50"
			>
				<Plus size={18} aria-hidden="true" />{ml} ml
			</button>
		{/each}
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
