<script lang="ts">
	// Manual activity (docs/design.md): calories burned above an inactive day, with an optional note. Either a
	// workout, which adds, or the watch's active-calorie total for the day so far, which replaces the day's earlier
	// total. The sheet states both meanings plainly.
	import { untrack } from 'svelte';
	import { m } from '#lib/paraglide/messages.js';
	import { api } from '#lib/client/api.ts';
	import { deviceZone } from '#lib/client/prefs.ts';
	import type { ActivityEntry } from '#lib/shared/body-types.ts';
	import { kcal } from '#lib/shared/format.ts';
	import { parseDecimal } from '#lib/shared/numbers.ts';
	import Button from '../Button.svelte';
	import Chips from '../Chips.svelte';
	import Notice from '../Notice.svelte';
	import Sheet from '../Sheet.svelte';
	import TextField from '../TextField.svelte';

	interface Props {
		/** Activity already counted in this day's budget. */
		counted?: number;
		date: string;
		/** The day's newest watch total, if any. */
		watchTotal: number | null;
		onsaved: (entry: ActivityEntry) => void;
		onclose: () => void;
	}
	let { counted = 0, date, watchTotal, onsaved, onclose }: Props = $props();
	// Someone who already entered a watch total today most likely updates it.
	let kind = $state<ActivityEntry['kind']>(untrack(() => (watchTotal ? 'day_total' : 'extra')));
	let kcalText = $state('');
	let note = $state('');
	let busy = $state(false);
	let problem = $state('');
	const value = $derived(parseDecimal(kcalText));
	const valid = $derived(value !== undefined && value >= 1 && value <= 10_000);

	async function save(event: SubmitEvent) {
		event.preventDefault();
		if (!valid) return;
		busy = true;
		problem = '';
		try {
			onsaved(
				await api<ActivityEntry>('POST', '/api/v1/body/activity', {
					id: crypto.randomUUID(),
					date,
					zone: deviceZone(),
					value: Math.round(value!),
					note: note || null,
					kind
				})
			);
		} catch {
			problem = m.error_generic();
		} finally {
			busy = false;
		}
	}
</script>

<Sheet title={m.activity_title()} {onclose}>
	<form class="flex flex-col gap-4" onsubmit={save}>
		<Chips
			label={m.activity_kind()}
			bind:value={kind}
			options={[
				{ value: 'extra', label: m.activity_kind_extra() },
				{ value: 'day_total', label: m.activity_kind_total() }
			]}
		/>
		<p class="text-[0.875rem] text-muted">
			{kind === 'extra' ? m.activity_meaning() : m.activity_total_meaning()}
		</p>
		{#if kind === 'extra'}
			<p class="-mt-2 text-[0.875rem] text-muted tabular-nums">
				{counted ? m.activity_counted({ kcal: kcal(counted) }) : m.activity_counted_none()}
			</p>
		{/if}
		{#if kind === 'day_total' && watchTotal}
			<p class="text-[0.875rem] font-semibold tabular-nums">
				{m.activity_total_current({ kcal: kcal(watchTotal) })}
			</p>
		{/if}
		<TextField
			label={m.activity_kcal()}
			bind:value={kcalText}
			inputmode="numeric"
			autocomplete="off"
			aria-invalid={kcalText.trim() !== '' && !valid}
		/>
		{#if kind === 'extra'}
			<div class="grid grid-cols-3 gap-2">
				{#each [100, 150, 250] as amount (amount)}
					<button
						type="button"
						onclick={() => (kcalText = String(amount))}
						aria-pressed={kcalText === String(amount)}
						class={[
							'min-h-11 rounded-input text-[0.9375rem] font-bold tabular-nums transition-colors',
							kcalText === String(amount) ? 'bg-soft text-accent' : 'bg-surface2'
						]}>{amount}</button
					>
				{/each}
			</div>
		{/if}
		{#if kind === 'extra'}
			<TextField
				label={m.activity_note()}
				placeholder={m.activity_note_placeholder()}
				bind:value={note}
				maxlength={120}
			/>
		{/if}
		{#if problem}<Notice>{problem}</Notice>{/if}
		<Button type="submit" wide disabled={busy || !valid}
			>{busy
				? m.common_working()
				: kind === 'extra'
					? m.activity_save()
					: m.activity_total_save()}</Button
		>
	</form>
</Sheet>
