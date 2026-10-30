<script lang="ts">
	// docs/ui.md "Budget card": ring of eaten ÷ budget, accent while under and red (bad) when over; Eaten, Budget and
	// the equation (base + activity − deficit) beside it.
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

	const R = 52;
	const C = 2 * Math.PI * R;
	const total = $derived(budget?.budget ?? null);
	const over = $derived(total !== null && eaten > total);
	const fraction = $derived(total ? Math.min(eaten / total, 1) : 0);
</script>

<section
	class="flex flex-col gap-3 rounded-card bg-surface p-[18px] shadow-card"
	aria-label={m.budget_title()}
>
	<div class="flex items-center gap-[18px]">
		<div class="relative size-32 shrink-0 desk:size-[150px]">
			<svg viewBox="0 0 120 120" class="size-full -rotate-90" aria-hidden="true">
				<circle cx="60" cy="60" r={R} fill="none" stroke="var(--track)" stroke-width="10" />
				{#if total}
					<circle
						cx="60"
						cy="60"
						r={R}
						fill="none"
						stroke={over ? 'var(--bad)' : 'var(--accent)'}
						stroke-width="10"
						stroke-linecap="round"
						stroke-dasharray={C}
						stroke-dashoffset={C * (1 - fraction)}
						class="transition-[stroke-dashoffset] duration-300"
					/>
				{/if}
			</svg>
			<div class="absolute inset-0 grid place-content-center text-center">
				{#if total}
					<span
						class={[
							'font-display text-[30px] leading-none font-extrabold tracking-[-0.03em] tabular-nums desk:text-[36px]',
							over && 'text-bad'
						]}>{kcal(Math.abs(total - eaten))}</span
					>
					<span class={['text-[12.5px] font-semibold', over ? 'text-bad' : 'text-muted']}
						>{over ? m.budget_over() : m.budget_left()}</span
					>
				{:else}
					<span
						class="font-display text-[30px] leading-none font-extrabold tracking-[-0.03em] tabular-nums desk:text-[36px]"
						>{kcal(eaten)}</span
					>
					<span class="text-[12.5px] font-semibold text-muted">{m.budget_eaten_kcal()}</span>
				{/if}
			</div>
		</div>
		<dl class="flex min-w-0 flex-col gap-2">
			<div>
				<dt class="text-[13px] font-[650] text-muted">{m.budget_eaten()}</dt>
				<dd class="text-[19px] font-bold tabular-nums">{kcal(eaten)} kcal</dd>
			</div>
			<div>
				<dt class="text-[13px] font-[650] text-muted">{m.budget_budget()}</dt>
				{#if budget}
					<dd class="text-[15px] font-semibold tabular-nums">{kcal(budget.budget)} kcal</dd>
					<dd class="text-[12.5px] text-muted tabular-nums">
						{manual && !budget.activityKcal
							? m.budget_manual()
							: m.budget_equation({
									base: kcal(budget.baseKcal),
									activity: kcal(budget.activityKcal),
									deficit: kcal(budget.deficitKcal)
								})}
					</dd>
					{#if budget.activityNotAddedKcal}<dd class="text-[12.5px] text-muted">
							{m.budget_activity_not_added({ kcal: kcal(budget.activityNotAddedKcal) })}
						</dd>{/if}
					{#if budget.floorApplied}<dd class="text-[12.5px] text-muted">
							{m.budget_floor({ floor: kcal(floor) })}
						</dd>{/if}
				{:else}
					<dd class="text-[15px] font-semibold">{m.budget_not_set()}</dd>
					<dd>
						<a
							href={resolve('/(app)/onboarding')}
							class="text-[14px] font-semibold text-accent underline">{m.budget_setup()}</a
						>
					</dd>
				{/if}
			</div>
		</dl>
	</div>
	{#if budget}
		<button
			type="button"
			onclick={onaddactivity}
			class="inline-flex min-h-11 items-center justify-center gap-1.5 self-start rounded-full bg-soft px-4 text-[15px] font-bold text-accent"
		>
			<Plus size={18} aria-hidden="true" />{m.activity_add()}
		</button>
	{/if}
</section>
