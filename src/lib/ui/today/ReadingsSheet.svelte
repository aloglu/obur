<script lang="ts">
	// Edit or delete water and weight readings after the Undo toast is gone. A deleted row stays in place with its
	// own Undo (a toast would sit behind the open sheet). Weight changes can move a calculated budget, which the
	// sheet reports in place.
	import { page } from '$app/state';
	import { clockTime } from '#lib/client/prefs.ts';
	import { untrack } from 'svelte';
	import { m } from '#lib/paraglide/messages.js';
	import { api, ApiError } from '#lib/client/api.ts';
	import type { BodyReading } from '#lib/shared/body-types.ts';
	import { dayTitle, kcal } from '#lib/shared/format.ts';
	import { formatDecimal, parseDecimal } from '#lib/shared/numbers.ts';
	import Notice from '../Notice.svelte';
	import Sheet from '../Sheet.svelte';

	type Budget = { beforeKcal: number; afterKcal: number } | null;
	interface Props {
		kind: 'water' | 'weight';
		title: string;
		/** Newest first. */
		readings: BodyReading[];
		today: string;
		/** Loads the next page after the last reading shown (newest first); an empty page means there are no more. */
		older?: (after: BodyReading | undefined) => Promise<BodyReading[]>;
		onchange: () => Promise<void>;
		onclose: () => void;
	}
	let { kind, title, readings, today, older, onchange, onclose }: Props = $props();

	let rows = $state(untrack(() => readings.map((r) => ({ reading: r, deleted: false }))));
	let editing = $state<string | null>(null);
	let text = $state('');
	let busy = $state(false);
	let problem = $state('');
	let budget = $state<Budget>(null);
	let noMore = $state(false);

	const unit = $derived(kind === 'weight' ? 'kg' : 'ml');
	const show = (value: number) => formatDecimal(value, ',', kind === 'weight' ? 2 : 0);
	const time = (iso: string) => clockTime(iso, page.data.timeFormat ?? 'device');
	const value = $derived(parseDecimal(text));
	// The same ranges as the database: weight under 700 kg, water up to 10 litres.
	const valid = $derived(
		value !== undefined && value > 0 && (kind === 'weight' ? value < 700 : value <= 10_000)
	);

	async function run(action: () => Promise<void>) {
		busy = true;
		problem = '';
		try {
			await action();
			await onchange();
		} catch (e) {
			problem =
				e instanceof ApiError && (e.status === 409 || e.status === 404)
					? m.readings_changed()
					: m.error_generic();
		} finally {
			busy = false;
		}
	}

	const save = (i: number) =>
		run(async () => {
			const r = rows[i].reading;
			const updated = await api<BodyReading & { budget?: Budget }>(
				'PATCH',
				`/api/v1/body/${kind}/${r.id}`,
				{ revision: r.revision, value }
			);
			rows[i].reading = updated;
			budget = updated.budget ?? budget;
			editing = null;
		});

	const setDeleted = (i: number, deleted: boolean) =>
		run(async () => {
			const r = rows[i].reading;
			const result = await api<{ budget?: Budget }>(
				'POST',
				`/api/v1/body/${kind}/${r.id}?action=${deleted ? 'delete' : 'restore'}`,
				{}
			);
			// The trash action raised the revision.
			rows[i] = { reading: { ...r, revision: r.revision + 1 }, deleted };
			budget = result.budget ?? budget;
		});

	async function loadOlder() {
		if (!older) return;
		busy = true;
		problem = '';
		try {
			const more = await older(rows.at(-1)?.reading);
			if (more.length === 0) noMore = true;
			rows.push(...more.map((r) => ({ reading: r, deleted: false })));
		} catch {
			problem = m.error_generic();
		} finally {
			busy = false;
		}
	}
</script>

<Sheet {title} {onclose}>
	{#if budget}
		<Notice tone="info"
			>{m.toast_budget_now({
				after: kcal(budget.afterKcal),
				before: kcal(budget.beforeKcal)
			})}</Notice
		>
	{/if}
	{#if problem}<Notice>{problem}</Notice>{/if}
	{#if rows.length === 0}
		<p class="text-[14px] text-muted">{m.readings_none()}</p>
	{/if}
	<ul class="flex flex-col divide-y divide-line">
		{#each rows as row, i (row.reading.id)}
			{@const r = row.reading}
			{@const when =
				kind === 'weight'
					? `${dayTitle(r.localDate, today)} · ${time(r.createdAt)}`
					: time(r.createdAt)}
			<li class="flex min-h-14 items-center gap-2 py-2">
				{#if editing === r.id}
					<form
						class="flex flex-1 items-center gap-2"
						onsubmit={(e) => {
							e.preventDefault();
							if (valid) save(i);
						}}
					>
						<label class="sr-only" for="reading-{r.id}"
							>{m.readings_value_label({ unit, when })}</label
						>
						<input
							id="reading-{r.id}"
							bind:value={text}
							inputmode="decimal"
							autocomplete="off"
							aria-invalid={text.trim() !== '' && !valid}
							class="min-h-11 w-0 flex-1 rounded-input border border-line bg-surface2 px-3 text-[16px] font-semibold tabular-nums"
						/>
						<span class="text-[14px] text-muted">{unit}</span>
						<button
							type="submit"
							disabled={busy || !valid}
							class="min-h-11 rounded-input bg-fill px-3 text-[14px] font-bold text-on-accent disabled:opacity-50"
							>{m.weight_save()}</button
						>
						<button
							type="button"
							onclick={() => (editing = null)}
							class="min-h-11 rounded-input px-2 text-[14px] font-semibold text-muted"
							>{m.common_cancel()}</button
						>
					</form>
				{:else}
					<div class="flex min-w-0 flex-1 flex-col" class:opacity-60={row.deleted}>
						<span class="text-[16px] font-bold tabular-nums" class:line-through={row.deleted}
							>{show(r.value)} {unit}</span
						>
						<span class="text-[13px] text-muted">{row.deleted ? m.readings_deleted() : when}</span>
					</div>
					{#if row.deleted}
						<button
							type="button"
							disabled={busy}
							onclick={() => setDeleted(i, false)}
							aria-label={m.readings_undo_label({ value: show(r.value), unit, when })}
							class="min-h-11 rounded-input px-3 text-[14px] font-bold text-accent"
							>{m.toast_undo()}</button
						>
					{:else}
						<button
							type="button"
							disabled={busy}
							onclick={() => {
								editing = r.id;
								text = show(r.value);
							}}
							aria-label={m.readings_edit_label({ value: show(r.value), unit, when })}
							class="min-h-11 rounded-input px-3 text-[14px] font-semibold"
							>{m.readings_edit()}</button
						>
						<button
							type="button"
							disabled={busy}
							onclick={() => setDeleted(i, true)}
							aria-label={m.readings_delete_label({ value: show(r.value), unit, when })}
							class="min-h-11 rounded-input px-3 text-[14px] font-semibold text-bad"
							>{m.readings_delete()}</button
						>
					{/if}
				{/if}
			</li>
		{/each}
	</ul>
	{#if older && !noMore}
		<button
			type="button"
			disabled={busy}
			onclick={loadOlder}
			class="min-h-12 w-full rounded-input bg-surface2 text-[15px] font-bold disabled:opacity-50"
			>{m.readings_older()}</button
		>
	{/if}
</Sheet>
