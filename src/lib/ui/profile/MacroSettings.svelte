<script lang="ts">
	// Macro targets on Profile (owner review 2026-10-30): the balanced default (protein from body weight, fat 30 % of
	// the budget, carbohydrate the rest; it follows the budget) or the person's own whole-percent shares of the
	// budget, for low-carb and similar diets. Saved from today on like the other budget settings.
	import { untrack } from 'svelte';
	import { m } from '#lib/paraglide/messages.js';
	import { kcal } from '#lib/shared/format.ts';
	import type { MacroChoice, TargetVersion } from '#lib/shared/goal-types.ts';
	import { macroTargetsFor } from '#lib/shared/goals.ts';
	import Chips from '../Chips.svelte';

	interface Props {
		target: TargetVersion;
		/** The day's budget before activity, for the gram preview. */
		budgetKcal: number;
		busy: boolean;
		onsave: (macros: MacroChoice) => Promise<void>;
	}
	let { target, budgetKcal, busy, onsave }: Props = $props();

	const balancedAvailable = $derived(target.mode === 'calculated');
	let mode = $state<'balanced' | 'percent'>(untrack(() => target.macroMode));
	/** Protein, carbohydrate and fat, as typed. */
	let pct = $state(['', '', '']);

	/** Starting numbers: the saved shares, or today's balanced split as whole percents. */
	function fill() {
		const whole = (share: number | null) => String(Math.round((share ?? 0) * 100));
		if (target.macroMode === 'percent') {
			pct = [whole(target.proteinShare), whole(target.carbShare), whole(target.fatShare)];
			return;
		}
		const g = macroTargetsFor(budgetKcal, target);
		if (!g || budgetKcal <= 0) {
			pct = ['30', '40', '30'];
			return;
		}
		const p = Math.round(((g.proteinG * 4) / budgetKcal) * 100);
		const f = Math.round(((g.fatG * 9) / budgetKcal) * 100);
		pct = [String(p), String(Math.max(0, 100 - p - f)), String(f)];
	}
	fill();

	const read = (s: string) => (/^\d{1,3}$/.test(s.trim()) ? Number(s) : NaN);
	const shares = $derived(pct.map(read));
	const total = $derived(shares.reduce((a, b) => a + b, 0));
	const valid = $derived(shares.every((n) => Number.isInteger(n) && n <= 100) && total === 100);
	const saved = $derived(
		target.macroMode === 'percent' &&
			valid &&
			Math.round((target.proteinShare ?? 0) * 100) === shares[0] &&
			Math.round((target.carbShare ?? 0) * 100) === shares[1] &&
			Math.round((target.fatShare ?? 0) * 100) === shares[2]
	);
	const grams = $derived(
		valid
			? [
					Math.round((budgetKcal * shares[0]) / 100 / 4),
					Math.round((budgetKcal * shares[1]) / 100 / 4),
					Math.round((budgetKcal * shares[2]) / 100 / 9)
				]
			: null
	);
	const fields = $derived([
		{ id: 'macro-protein', label: m.nutrient_short_protein(), color: 'var(--protein)' },
		{ id: 'macro-carbs', label: m.nutrient_short_carbohydrate(), color: 'var(--carb)' },
		{ id: 'macro-fat', label: m.nutrient_short_fat(), color: 'var(--fat)' }
	]);

	async function choose(next: 'balanced' | 'percent') {
		mode = next;
		if (next === 'balanced' && target.macroMode === 'percent') await onsave({ mode: 'balanced' });
		if (next === 'percent') fill();
	}

	async function save(event: SubmitEvent) {
		event.preventDefault();
		if (!valid) return;
		await onsave({ mode: 'percent', proteinPct: shares[0], carbPct: shares[1], fatPct: shares[2] });
	}
</script>

<div class="flex flex-col gap-2">
	<Chips
		label={m.macros_title()}
		value={mode}
		onchange={choose}
		options={[
			{
				value: 'balanced',
				label: balancedAvailable ? m.macros_balanced() : m.macros_none()
			},
			{ value: 'percent', label: m.macros_own() }
		]}
	/>
	{#if mode === 'balanced'}
		<p class="text-[13px] text-muted">
			{balancedAvailable ? m.macros_balanced_hint() : m.macros_none_hint()}
		</p>
	{:else}
		<form class="flex flex-col gap-2" onsubmit={save} novalidate>
			<div class="grid grid-cols-3 gap-2">
				{#each fields as field, i (field.id)}
					<div class="flex min-w-0 flex-col gap-1">
						<label
							for={field.id}
							class="flex items-center gap-1.5 text-[13px] font-[650] text-muted"
						>
							<span class="size-2 shrink-0 rounded-full" style:background={field.color}></span>
							{field.label}
						</label>
						<div
							class="flex h-12 items-center rounded-input bg-surface2 px-3 ring-1 ring-line focus-within:ring-2 focus-within:ring-accent"
						>
							<input
								id={field.id}
								bind:value={pct[i]}
								inputmode="numeric"
								autocomplete="off"
								class="w-full min-w-0 bg-transparent text-[16px] font-semibold tabular-nums outline-none"
							/>
							<span class="text-[15px] font-semibold text-muted" aria-hidden="true">%</span>
						</div>
						<p class="text-[13px] text-muted tabular-nums">
							{grams ? `${grams[i]} g` : ' '}
						</p>
					</div>
				{/each}
			</div>
			<p
				class={['text-[13px] font-semibold', valid ? 'text-muted' : 'text-bad']}
				aria-live="polite"
			>
				{valid
					? m.macros_total_ok({ kcal: kcal(budgetKcal) })
					: m.macros_total_off({ total: Number.isNaN(total) ? '?' : String(total) })}
			</p>
			<button
				type="submit"
				disabled={busy || !valid || saved}
				class="min-h-12 rounded-button bg-accent text-[16px] font-[750] text-on-accent disabled:opacity-50"
				>{saved ? m.macros_saved() : m.macros_save()}</button
			>
		</form>
	{/if}
</div>
