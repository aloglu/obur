<script lang="ts">
	// docs/ui.md "Budget card" (owner's pick, 2026-10-30: "number and bar"): kcal left as the headline, one full-width
	// bar of eaten ÷ budget (accent while under, red when over), Eaten and Budget at its ends. The budget's breakdown
	// (base, activity, goal, and notes) opens from the Budget figure, keeping the card face clean.
	import ChevronDown from '@lucide/svelte/icons/chevron-down';
	import { resolve } from '$app/paths';
	import Plus from '@lucide/svelte/icons/plus';
	import { m } from '#lib/paraglide/messages.js';
	import { kcal } from '#lib/shared/format.ts';
	import type { DayBudget } from '#lib/shared/goals.ts';

	interface Props {
		eaten: number;
		budget: DayBudget | null;
		manual: boolean;
		floor: number;
		onaddactivity: () => void;
	}
	let { eaten, budget, manual, floor, onaddactivity }: Props = $props();

	let showBreakdown = $state(false);
	const total = $derived(budget?.budget ?? null);
	const over = $derived(total !== null && eaten > total);
	const fraction = $derived(total ? Math.min(eaten / total, 1) : 0);
</script>

<section
	class="flex flex-col gap-3 rounded-card bg-surface p-[18px] shadow-card"
	aria-label={m.budget_title()}
>
	<div class="flex items-start justify-between gap-3">
		<p class="flex flex-wrap items-baseline gap-x-2" aria-live="polite">
			<span
				class={[
					'font-display text-[44px] leading-none font-extrabold tracking-[-0.03em] tabular-nums desk:text-[48px]',
					over && 'text-bad'
				]}>{kcal(total ? Math.abs(total - eaten) : eaten)}</span
			>
			<span class={['text-[15px] font-semibold', over ? 'text-bad' : 'text-muted']}
				>{!total ? m.budget_eaten_kcal() : over ? m.budget_over() : m.budget_left()}</span
			>
		</p>
		{#if budget}
			<button
				type="button"
				onclick={onaddactivity}
				aria-label={m.activity_add()}
				class="inline-flex min-h-11 shrink-0 items-center gap-1.5 rounded-input bg-soft px-3.5 text-[15px] font-bold text-accent"
			>
				<Plus size={18} aria-hidden="true" />{m.budget_activity_short()}
			</button>
		{/if}
	</div>
	{#if budget}
		<div
			class="h-3 overflow-hidden rounded-full bg-track"
			role="img"
			aria-label={m.budget_bar_label({ eaten: kcal(eaten), budget: kcal(budget.budget) })}
		>
			<div
				class={[
					'h-full rounded-full transition-[width] duration-300 motion-reduce:transition-none',
					over ? 'bg-bad' : 'bg-accent'
				]}
				style:width="{fraction * 100}%"
			></div>
		</div>
		<div class="flex items-start justify-between gap-3">
			<div>
				<p class="text-[13px] font-[650] text-muted">{m.budget_eaten()}</p>
				<p class="text-[17px] font-bold tabular-nums">{kcal(eaten)} kcal</p>
			</div>
			<button
				type="button"
				onclick={() => (showBreakdown = !showBreakdown)}
				aria-expanded={showBreakdown}
				aria-controls="budget-breakdown"
				class="-my-1 -mr-2 flex min-h-11 flex-col items-end rounded-input px-2 py-1 text-right hover:bg-surface2"
			>
				<span class="flex items-center gap-1 text-[13px] font-[650] text-muted"
					>{m.budget_budget()}<ChevronDown
						size={14}
						aria-hidden="true"
						class={[
							'transition-transform motion-reduce:transition-none',
							showBreakdown && 'rotate-180'
						]}
					/></span
				>
				<span class="text-[17px] font-bold tabular-nums">{kcal(budget.budget)} kcal</span>
			</button>
		</div>
		{#if showBreakdown}
			<dl
				id="budget-breakdown"
				class="flex flex-col rounded-small bg-surface2 px-3.5 py-1 text-[14px]"
			>
				<div class="flex min-h-9 items-center justify-between gap-3 border-b border-line">
					<dt class="text-muted">{manual ? m.budget_row_own() : m.budget_row_base()}</dt>
					<dd class="font-semibold tabular-nums">{kcal(budget.baseKcal)} kcal</dd>
				</div>
				<div class="flex min-h-9 items-center justify-between gap-3 border-b border-line">
					<dt class="text-muted">{m.budget_row_activity()}</dt>
					<dd class="font-semibold tabular-nums">+ {kcal(budget.activityKcal)} kcal</dd>
				</div>
				{#if !manual}
					<div class="flex min-h-9 items-center justify-between gap-3 border-b border-line">
						<dt class="text-muted">{m.budget_row_goal()}</dt>
						<dd class="font-semibold tabular-nums">− {kcal(budget.deficitKcal)} kcal</dd>
					</div>
				{/if}
				<div class="flex min-h-9 items-center justify-between gap-3">
					<dt class="font-semibold">{m.budget_budget()}</dt>
					<dd class="font-bold tabular-nums">{kcal(budget.budget)} kcal</dd>
				</div>
				{#if budget.activityNotAddedKcal}<p class="pb-2 text-[12.5px] text-muted">
						{m.budget_activity_not_added({ kcal: kcal(budget.activityNotAddedKcal) })}
					</p>{/if}
				{#if budget.floorApplied}<p class="pb-2 text-[12.5px] text-muted">
						{m.budget_floor({ floor: kcal(floor) })}
					</p>{/if}
			</dl>
		{/if}
	{:else}
		<div class="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
			<p class="text-[15px]">
				<span class="text-[13px] font-[650] text-muted">{m.budget_budget()}</span>
				<span class="font-semibold">{m.budget_not_set()}</span>
			</p>
			<a
				href={resolve('/(app)/onboarding')}
				class="inline-flex min-h-11 items-center text-[14px] font-semibold text-accent underline"
				>{m.budget_setup()}</a
			>
		</div>
	{/if}
</section>
