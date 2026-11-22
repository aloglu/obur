<script lang="ts">
	// New weigh-in, opening in place like Other amount (docs/ui.md, "Inline fields"): a button that turns into a weight
	// field in the person's unit (kg or lb), with a round check. Saved at once (it says so when it can't be); the toast offers Undo and says when a calculated
	// budget moved. Used on Today's Weight card and on an empty Progress.
	import Check from '@lucide/svelte/icons/check';
	import { m } from '#lib/paraglide/messages.js';
	import { api, NoConnection, save as send } from '#lib/client/api.ts';
	import { inlineField } from '#lib/client/inline-field.svelte.ts';
	import { deviceZone } from '#lib/client/prefs.ts';
	import { showToast } from '#lib/client/toast.svelte.ts';
	import { kcal } from '#lib/shared/format.ts';
	import { parseDecimal } from '#lib/shared/numbers.ts';
	import { toKg, typedKg, weightText } from '#lib/shared/weight-unit.ts';
	import { weightUnit } from '#lib/client/weight-unit.ts';

	interface Props {
		/** The day the weigh-in is for. */
		date: string;
		/** Which inline field this is: only one is open at a time. */
		key: string;
		/** The closed button's look, where it differs from Today's. */
		buttonClass?: string;
		onchange: () => Promise<void>;
	}
	let {
		date,
		key,
		buttonClass = 'min-h-12 rounded-input bg-surface2 text-[0.9375rem] font-bold transition-transform active:scale-[0.97] disabled:opacity-50',
		onchange
	}: Props = $props();
	let text = $state('');
	let busy = $state(false);
	const open = $derived(inlineField.open === key);

	$effect(() => {
		if (!open) text = '';
	});

	const unit = $derived(weightUnit());
	const typed = $derived(parseDecimal(text));
	const kg = $derived(typed === undefined ? undefined : typedKg(typed, unit));
	const invalid = $derived(
		text.trim() !== '' && (typed === undefined || typed <= 0 || toKg(typed, unit) >= 700)
	);

	type BudgetChange = { beforeKcal: number; afterKcal: number } | null;
	const budgetDetail = (b: BudgetChange | undefined) =>
		b ? m.toast_budget_now({ after: kcal(b.afterKcal), before: kcal(b.beforeKcal) }) : undefined;

	async function save(value: number) {
		busy = true;
		try {
			const r = await send<{ id: string; budget?: BudgetChange }>('/api/v1/body/weight', {
				id: crypto.randomUUID(),
				date,
				zone: deviceZone(),
				value
			});
			inlineField.open = null;
			await onchange();
			showToast({
				message: m.toast_weight({ weight: weightText(value, unit) }),
				detail: budgetDetail(r.budget),
				undo: async () => {
					await api('POST', `/api/v1/body/weight/${r.id}?action=delete`, {});
					await onchange();
				}
			});
		} catch (e) {
			showToast({
				message: e instanceof NoConnection ? m.save_no_connection() : m.error_generic()
			});
		} finally {
			busy = false;
		}
	}
</script>

{#if open}
	<form
		class="field-swap"
		onsubmit={(e) => {
			e.preventDefault();
			// Empty, the check closes the field, like a tap elsewhere.
			if (text.trim() === '') inlineField.open = null;
			else if (kg !== undefined && !invalid) save(kg);
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
				id="{key}-input"
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
				class="w-0 min-w-0 flex-1 bg-transparent text-[1rem] font-semibold tabular-nums outline-none placeholder:font-medium placeholder:text-muted"
			/>
			<span class="shrink-0 px-1 text-[0.875rem] font-[650] text-muted">{unit}</span>
			<button
				type="submit"
				disabled={busy || invalid}
				aria-label={m.weight_save()}
				class="grid size-10 shrink-0 place-items-center rounded-small bg-fill text-on-accent disabled:opacity-50"
				><Check size={18} aria-hidden="true" /></button
			>
		</div>
		{#if invalid}<p class="mt-1 px-1 text-[0.8125rem] font-semibold text-bad">
				{m.weight_invalid()}
			</p>{/if}
	</form>
{:else}
	<button type="button" disabled={busy} onclick={() => (inlineField.open = key)} class={buttonClass}
		>{m.weight_new()}</button
	>
{/if}
