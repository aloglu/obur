<script lang="ts">
	// docs/ui.md "Water and Weight": four rows lined up with Water's: title, latest weight and change, the last seven
	// weigh-ins, and New weigh-in, which opens in place as a field.
	import { m } from '#lib/paraglide/messages.js';
	import { api } from '#lib/client/api.ts';
	import { offline } from '#lib/client/offline/sync.svelte.ts';
	import { showToast } from '#lib/client/toast.svelte.ts';
	import type { BodyReading } from '#lib/shared/body-types.ts';
	import { weekdayShort } from '#lib/shared/format.ts';
	import { formatDecimal } from '#lib/shared/numbers.ts';
	import Roll from '../Roll.svelte';
	import ReadingsSheet from './ReadingsSheet.svelte';
	import WeighIn from './WeighIn.svelte';
	import WeightSpark from './WeightSpark.svelte';

	interface Props {
		date: string;
		today: string;
		/** Newest first, up to seven, on or before this day. */
		recent: BodyReading[];
		onchange: () => Promise<void>;
	}
	let { date, today, recent, onchange }: Props = $props();
	let busy = $state(false);
	let history = $state<BodyReading[] | null>(null);

	const latest = $derived(recent[0] ?? null);
	const previous = $derived(recent[1] ?? null);
	const change = $derived(
		latest && previous ? Math.round((latest.value - previous.value) * 10) / 10 : null
	);
	const spark = $derived(recent.map((r) => r.value).toReversed());
	const show = (kg: number) => formatDecimal(kg, 2);

	const PAGE = 20;
	const history_page = (after?: BodyReading) =>
		api<{ readings: BodyReading[] }>(
			'GET',
			`/api/v1/body/weight?limit=${PAGE}` +
				(after ? `&after=${after.localDate},${after.createdAt},${after.id}` : '')
		).then((r) => r.readings);

	async function openHistory() {
		busy = true;
		try {
			history = await history_page();
		} catch {
			showToast({ message: m.error_generic() });
		} finally {
			busy = false;
		}
	}
	const pendingKg = $derived(
		offline.items.findLast(
			(i) => i.status === 'pending' && i.preview.kind === 'weight' && i.preview.localDate === date
		)
	);
</script>

<section
	class="row-span-4 grid grid-rows-subgrid gap-y-0 rounded-card bg-surface px-3.5 pt-4 pb-[18px] shadow-card desk:px-[18px]"
	aria-labelledby="weight-title"
>
	<div class="flex h-6 items-center justify-between gap-2">
		<h2 id="weight-title" class="text-[0.9375rem] font-bold">{m.weight_title()}</h2>
		{#if latest}
			<button
				type="button"
				disabled={busy}
				onclick={openHistory}
				aria-label={m.weight_edit_label()}
				class="-mr-1.5 min-h-11 px-1.5 text-[0.875rem] font-[650] text-accent"
				>{m.weight_edit()}</button
			>
		{/if}
	</div>
	<div class="mt-2.5 flex flex-col gap-[3px]">
		{#if latest}
			<p
				class="font-display text-[1.625rem] leading-[1.1] font-[750] tracking-[-0.02em] tabular-nums"
			>
				<Roll value={show(latest.value)} />
				<small class="font-sans text-[0.8125rem] font-semibold tracking-normal text-muted">kg</small
				>
			</p>
		{:else}
			<p
				class="font-display text-[1.625rem] leading-[1.1] font-[750] tracking-[-0.02em] text-muted tabular-nums"
			>
				–
			</p>
		{/if}
		<p class="text-[0.8125rem] leading-[1.3] text-muted">
			{#if pendingKg?.preview.kind === 'weight'}
				<span class="font-semibold text-warn"
					>{m.offline_weight_pending({ kg: show(pendingKg.preview.kg) })}</span
				>
			{:else if !latest}
				{m.weight_none()}
			{:else if !previous}
				{m.weight_first()}
			{:else if change === 0}
				{m.weight_same_as({ day: weekdayShort(previous.localDate) })}
			{:else}
				<b class={['font-semibold tabular-nums', change! < 0 ? 'text-good' : 'text-text']}
					>{change! < 0 ? '−' : '+'}{formatDecimal(Math.abs(change!), 1)} kg</b
				>
				{m.weight_since({ day: weekdayShort(previous.localDate) })}
			{/if}
		</p>
	</div>
	<div class="mt-3.5">
		<WeightSpark values={spark} />
	</div>
	<div class="mt-1.5 grid">
		<WeighIn {date} key="weight" {onchange} />
	</div>
</section>

{#if history}
	<ReadingsSheet
		kind="weight"
		title={m.weight_sheet_title()}
		readings={history}
		{today}
		older={history_page}
		{onchange}
		onclose={() => (history = null)}
	/>
{/if}
