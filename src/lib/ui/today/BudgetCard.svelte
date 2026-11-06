<script lang="ts">
	// docs/ui.md "Budget card": kcal left as the headline with Activity beside it, one bar in status colours (green with
	// room, amber in the last 200 kcal or 10 %, red over), Eaten and Budget at its ends. The breakdown opens from Budget.
	// Without a budget it is just what was eaten: a budget is a free choice, and Today never asks for one.
	import ChevronRight from '@lucide/svelte/icons/chevron-right';
	import { m } from '#lib/paraglide/messages.js';
	import { kcal } from '#lib/shared/format.ts';
	import type { DayBudget } from '#lib/shared/goals.ts';
	import { budgetStatus } from '#lib/shared/goals.ts';
	import Roll from '../Roll.svelte';

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
	const status = $derived(total ? budgetStatus(eaten, total) : null);
	const over = $derived(status === 'over');
	const fraction = $derived(total ? Math.min(eaten / total, 1) : 0);
</script>

<section
	class="flex flex-col rounded-card bg-surface p-[18px] shadow-card"
	aria-label={m.budget_title()}
>
	<div class="flex items-start justify-between gap-2">
		<p class="min-w-0 whitespace-nowrap" aria-live="polite">
			<span
				class={[
					'font-display text-[46px] leading-none font-extrabold tracking-[-0.03em] tabular-nums',
					over && 'text-bad'
				]}><Roll value={kcal(total ? Math.abs(total - eaten) : eaten)} /></span
			>
			<span class={['ml-1 text-[15px] font-[650]', over ? 'text-bad' : 'text-muted']}
				>{!total ? m.budget_eaten_kcal() : over ? m.budget_over() : m.budget_left()}</span
			>
		</p>
		{#if budget}
			<button
				type="button"
				onclick={onaddactivity}
				aria-label={m.activity_add()}
				class="relative mt-1 inline-flex h-[34px] shrink-0 items-center gap-1.5 rounded-small bg-surface2 px-[11px] text-[13.5px] font-semibold text-muted transition-transform after:absolute after:-inset-x-0.5 after:-inset-y-[5px] active:scale-[0.97]"
			>
				{m.budget_activity_short()}<b class="font-bold text-text tabular-nums"
					>{kcal(budget.activityKcal)}</b
				>
			</button>
		{/if}
	</div>
	{#if budget}
		<div
			class="mt-4 mb-1 h-3 overflow-hidden rounded-full bg-track"
			role="img"
			aria-label={m.budget_bar_label({ eaten: kcal(eaten), budget: kcal(budget.budget) })}
		>
			<div
				data-status={status}
				class={[
					'h-full rounded-full transition-[width,background-color] duration-600 ease-(--travel) motion-reduce:transition-none',
					status === 'over' ? 'bg-bad' : status === 'close' ? 'bg-warn' : 'bg-good'
				]}
				style:width="{fraction * 100}%"
			></div>
		</div>
		<div class="flex items-center justify-between gap-3 text-[14px] text-muted">
			<span class="flex items-center gap-1.5 whitespace-nowrap"
				>{m.budget_eaten()}<b class="font-bold text-text tabular-nums"
					><Roll value={kcal(eaten)} /></b
				></span
			>
			<button
				type="button"
				onclick={() => (showBreakdown = !showBreakdown)}
				aria-expanded={showBreakdown}
				aria-controls="budget-breakdown"
				class="-mr-1 flex min-h-11 items-center gap-1.5 whitespace-nowrap"
			>
				{m.budget_budget()}<b class="font-bold text-text tabular-nums">{kcal(budget.budget)}</b>
				<ChevronRight
					size={16}
					aria-hidden="true"
					class={[
						'transition-transform duration-300 ease-(--ui) motion-reduce:transition-none',
						showBreakdown && 'rotate-90'
					]}
				/>
			</button>
		</div>
		<div class={['collapse-row', showBreakdown && 'open']}>
			<div>
				<dl id="budget-breakdown" class="flex flex-col pt-2 text-[14px]">
					<div class="flex justify-between gap-3 py-2">
						<dt>{manual ? m.budget_row_own() : m.budget_row_base()}</dt>
						<dd class="tabular-nums">{kcal(budget.baseKcal)}</dd>
					</div>
					<div class="flex justify-between gap-3 border-t border-line py-2">
						<dt>{m.budget_row_activity()}</dt>
						<dd class="tabular-nums">+{kcal(budget.activityKcal)}</dd>
					</div>
					{#if !manual}
						<div class="flex justify-between gap-3 border-t border-line py-2">
							<dt>{m.budget_row_goal()}</dt>
							<dd class="tabular-nums">−{kcal(budget.deficitKcal)}</dd>
						</div>
					{/if}
					<div class="flex justify-between gap-3 border-t border-line py-2 font-bold">
						<dt>{m.budget_row_total()}</dt>
						<dd class="tabular-nums">{kcal(budget.budget)}</dd>
					</div>
					{#if budget.activityNotAddedKcal}<p class="pb-2 text-[12.5px] text-muted">
							{m.budget_activity_not_added({ kcal: kcal(budget.activityNotAddedKcal) })}
						</p>{/if}
					{#if budget.floorApplied}<p class="pb-2 text-[12.5px] text-muted">
							{m.budget_floor({ floor: kcal(floor) })}
						</p>{/if}
				</dl>
			</div>
		</div>
	{/if}
</section>
