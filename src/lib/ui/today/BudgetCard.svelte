<script lang="ts">
	// docs/ui.md "Budget card": ring of eaten ÷ budget; accent while under, red when over. Budgets arrive with goals
	// (Phase 1, step 7); until then the card shows what was eaten.
	import { m } from '#lib/paraglide/messages.js';
	import { kcal } from '#lib/shared/format.ts';

	let { eaten, budget }: { eaten: number; budget: number | null } = $props();

	const R = 52;
	const C = 2 * Math.PI * R;
	const over = $derived(budget !== null && eaten > budget);
	const fraction = $derived(budget ? Math.min(eaten / budget, 1) : 0);
</script>

<section
	class="flex items-center gap-[18px] rounded-card bg-surface p-[18px] shadow-card"
	aria-label={m.budget_title()}
>
	<div class="relative size-32 shrink-0 desk:size-[150px]">
		<svg viewBox="0 0 120 120" class="size-full -rotate-90" aria-hidden="true">
			<circle cx="60" cy="60" r={R} fill="none" stroke="var(--track)" stroke-width="10" />
			{#if budget}
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
			{#if budget}
				<span
					class={[
						'font-display text-[30px] leading-none font-extrabold tracking-[-0.03em] tabular-nums desk:text-[36px]',
						over && 'text-bad'
					]}>{kcal(Math.abs(budget - eaten))}</span
				>
				<span class="text-[12.5px] font-semibold text-muted"
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
			<dd class="text-[15px] font-semibold tabular-nums">
				{budget ? `${kcal(budget)} kcal` : m.budget_not_set()}
			</dd>
			{#if !budget}<dd class="text-[13px] text-muted">{m.budget_setup_soon()}</dd>{/if}
		</div>
	</dl>
</section>
