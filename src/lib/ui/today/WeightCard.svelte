<script lang="ts">
	// docs/ui.md "Water and Weight": four rows lined up with Water's: title, latest weight and change, the last seven
	// weigh-ins, and New weigh-in, which opens in place as a field.
	import Check from '@lucide/svelte/icons/check';
	import { m } from '#lib/paraglide/messages.js';
	import { api } from '#lib/client/api.ts';
	import { inlineField } from '#lib/client/inline-field.svelte.ts';
	import { offline, submit } from '#lib/client/offline/sync.svelte.ts';
	import { deviceZone } from '#lib/client/prefs.ts';
	import { showToast } from '#lib/client/toast.svelte.ts';
	import type { BodyReading } from '#lib/shared/body-types.ts';
	import { kcal, weekdayShort } from '#lib/shared/format.ts';
	import { formatDecimal, parseDecimal } from '#lib/shared/numbers.ts';
	import Roll from '../Roll.svelte';
	import ReadingsSheet from './ReadingsSheet.svelte';
	import WeightSpark from './WeightSpark.svelte';

	interface Props {
		date: string;
		today: string;
		/** Newest first, up to seven, on or before this day. */
		recent: BodyReading[];
		onchange: () => Promise<void>;
	}
	let { date, today, recent, onchange }: Props = $props();
	let text = $state('');
	let busy = $state(false);
	let history = $state<BodyReading[] | null>(null);
	const open = $derived(inlineField.open === 'weight');

	$effect(() => {
		if (!open) text = '';
	});

	const latest = $derived(recent[0] ?? null);
	const previous = $derived(recent[1] ?? null);
	const change = $derived(
		latest && previous ? Math.round((latest.value - previous.value) * 10) / 10 : null
	);
	const spark = $derived(recent.map((r) => r.value).toReversed());
	const show = (kg: number) => formatDecimal(kg, ',', 2);

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
	const kg = $derived(parseDecimal(text));
	const invalid = $derived(text.trim() !== '' && (kg === undefined || kg <= 0 || kg >= 700));

	type BudgetChange = { beforeKcal: number; afterKcal: number } | null;
	const budgetDetail = (b: BudgetChange | undefined) =>
		b ? m.toast_budget_now({ after: kcal(b.afterKcal), before: kcal(b.beforeKcal) }) : undefined;

	async function save(value: number) {
		busy = true;
		try {
			const result = await submit<{ id: string; budget?: BudgetChange }>(
				'/api/v1/body/weight',
				{ id: crypto.randomUUID(), date, zone: deviceZone(), value },
				{ kind: 'weight', localDate: date, kg: value }
			);
			inlineField.open = null;
			if (result.status === 'queued') {
				showToast({ message: m.offline_saved(), detail: m.offline_saved_detail() });
				return;
			}
			const r = result.data;
			await onchange();
			showToast({
				message: m.toast_weight({ kg: show(value) }),
				// A calculated budget follows the latest weight; Undo moves it back the same way.
				detail: budgetDetail(r.budget),
				undo: async () => {
					await api('POST', `/api/v1/body/weight/${r.id}?action=delete`, {});
					await onchange();
				}
			});
		} finally {
			busy = false;
		}
	}
</script>

<section
	class="row-span-4 grid grid-rows-subgrid gap-y-0 rounded-card bg-surface px-3.5 pt-4 pb-[18px] shadow-card desk:px-[18px]"
	aria-labelledby="weight-title"
>
	<div class="flex h-6 items-center justify-between gap-2">
		<h2 id="weight-title" class="text-[15px] font-bold">{m.weight_title()}</h2>
		{#if latest}
			<button
				type="button"
				disabled={busy}
				onclick={openHistory}
				aria-label={m.weight_edit_label()}
				class="-mr-1.5 min-h-11 px-1.5 text-[14px] font-[650] text-accent">{m.weight_edit()}</button
			>
		{/if}
	</div>
	<div class="mt-2.5 flex flex-col gap-[3px]">
		{#if latest}
			<p class="font-display text-[26px] leading-[1.1] font-[750] tracking-[-0.02em] tabular-nums">
				<Roll value={show(latest.value)} />
				<small class="font-sans text-[13px] font-semibold tracking-normal text-muted">kg</small>
			</p>
		{:else}
			<p
				class="font-display text-[26px] leading-[1.1] font-[750] tracking-[-0.02em] text-muted tabular-nums"
			>
				–
			</p>
		{/if}
		<p class="text-[13px] leading-[1.3] text-muted">
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
					>{change! < 0 ? '−' : '+'}{formatDecimal(Math.abs(change!), ',', 1)} kg</b
				>
				{m.weight_since({ day: weekdayShort(previous.localDate) })}
			{/if}
		</p>
	</div>
	<div class="mt-3.5">
		<WeightSpark values={spark} />
	</div>
	<div class="mt-1.5 grid">
		{#if open}
			<form
				class="field-swap"
				onsubmit={(e) => {
					e.preventDefault();
					if (kg !== undefined && !invalid) save(kg);
				}}
			>
				<div
					class={[
						'flex h-12 items-center gap-0.5 rounded-input bg-surface2 py-1 pr-1 pl-3 ring-1',
						invalid ? 'ring-bad' : 'ring-transparent focus-within:ring-accent'
					]}
				>
					<!-- svelte-ignore a11y_autofocus -->
					<input
						id="weight-input"
						bind:value={text}
						autofocus
						inputmode="decimal"
						autocomplete="off"
						aria-label={m.weight_input()}
						placeholder={m.weight_placeholder()}
						aria-invalid={invalid}
						onkeydown={(e) => {
							if (e.key === 'Escape') inlineField.open = null;
						}}
						class="w-0 min-w-0 flex-1 bg-transparent text-[16px] font-semibold tabular-nums outline-none placeholder:font-medium placeholder:text-muted"
					/>
					<span class="shrink-0 px-1 text-[14px] font-[650] text-muted">kg</span>
					<button
						type="submit"
						disabled={busy || kg === undefined || invalid}
						aria-label={m.weight_save()}
						class="grid size-10 shrink-0 place-items-center rounded-small bg-fill text-on-accent disabled:opacity-50"
						><Check size={18} aria-hidden="true" /></button
					>
				</div>
				{#if invalid}<p class="mt-1 px-1 text-[13px] font-semibold text-bad">
						{m.weight_invalid()}
					</p>{/if}
			</form>
		{:else}
			<button
				type="button"
				disabled={busy}
				onclick={() => (inlineField.open = 'weight')}
				class="min-h-12 rounded-input bg-surface2 text-[15px] font-bold transition-transform active:scale-[0.97] disabled:opacity-50"
				>{m.weight_new()}</button
			>
		{/if}
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
