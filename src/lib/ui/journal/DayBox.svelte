<script lang="ts">
	// docs/ui.md "Journal": the selected day in a box of fixed size, so nothing below moves as days change. Open goes to the
	// day. A day with nothing at all says only that; one with a weigh-in keeps its columns, so the weight shows. Eaten,
	// the budget's result and the weight sit in three equal columns under small labels (owner's pick, 2026-11-21).
	import ChevronRight from '@lucide/svelte/icons/chevron-right';
	import { m } from '#lib/paraglide/messages.js';
	import { dayHref } from '#lib/client/links.ts';
	import type { CalendarDay } from '#lib/shared/calendar.ts';
	import { dayBoxTitle, kcal } from '#lib/shared/format.ts';
	import { weightText } from '#lib/shared/weight-unit.ts';
	import { weightUnit } from '#lib/client/weight-unit.ts';
	import Roll from '../Roll.svelte';

	interface Props {
		day: CalendarDay;
		today: string;
		/** The day's last weigh-in, if any. */
		weight: number | null;
	}
	let { day, today, weight }: Props = $props();

	const logged = $derived(day.eatenKcal > 0 || day.status !== 'unlogged');
	const empty = $derived(!logged && weight === null);
	const title = $derived(dayBoxTitle(day.date, today));
	const left = $derived((day.budgetKcal ?? 0) - day.eatenKcal);
</script>

<div class="mt-3 flex flex-col gap-y-2 rounded-small bg-surface2 px-3.5 py-3" aria-live="polite">
	<div class="flex h-6 items-center justify-between gap-3 large:h-auto">
		{#key title}<span
				class="title-in min-w-0 truncate text-[0.9375rem] font-bold whitespace-nowrap large:whitespace-normal"
				>{title}{#if logged && day.status === 'incomplete'}<span
						class="ml-[0.3em] font-medium text-muted">· {m.journal_not_complete()}</span
					>{/if}</span
			>{/key}
		<a
			href={dayHref(day.date)}
			class="-mr-1 inline-flex min-h-11 shrink-0 items-center gap-0.5 text-[0.875rem] font-[650] text-text"
			>{m.journal_open()}<ChevronRight size={18} aria-hidden="true" class="text-accent" /></a
		>
	</div>
	{#if empty}
		<p
			class="grid min-h-[42px] place-items-center text-[0.875rem] leading-none font-medium text-muted"
		>
			{m.journal_nothing_logged()}
		</p>
	{:else}
		<!-- Three equal columns (owner, 2026-11-21): left, centred and right, each in its own third, so no value moves
		     another. Large text puts them under one another, label left and value right. -->
		<dl class="grid grid-cols-3 gap-x-3 tabular-nums large:grid-cols-1 large:gap-y-1">
			<div
				class="flex min-w-0 flex-col items-start large:flex-row large:items-baseline large:justify-between"
			>
				<dt class="label">{m.journal_eaten()}</dt>
				<dd class="value">
					{#if logged}<Roll value={kcal(day.eatenKcal)} />{#if day.partial}+{/if}{:else}<span
							class="text-muted">–</span
						>{/if}
				</dd>
			</div>
			<div
				class="flex min-w-0 flex-col items-center large:flex-row large:items-baseline large:justify-between"
			>
				<dt class="label">
					{day.status === 'under'
						? m.journal_under_budget()
						: day.status === 'over'
							? m.journal_over_budget()
							: day.budgetKcal === null
								? m.journal_budget()
								: m.journal_left()}
				</dt>
				<dd
					class={[
						'value transition-colors',
						day.status === 'under' ? 'text-good' : day.status === 'over' ? 'text-bad' : 'text-muted'
					]}
				>
					{#if logged && day.budgetKcal !== null}<Roll value={kcal(Math.abs(left))} />{:else}–{/if}
				</dd>
			</div>
			<div
				class="flex min-w-0 flex-col items-end large:flex-row large:items-baseline large:justify-between"
			>
				<dt class="label">{m.weight_title()}</dt>
				<dd class="value">
					{#if weight !== null}<Roll value={weightText(weight, weightUnit())} />{:else}<span
							class="text-muted">–</span
						>{/if}
				</dd>
			</div>
		</dl>
	{/if}
</div>

<style>
	.label {
		font-size: 0.78125rem;
		color: var(--color-muted);
		white-space: nowrap;
	}
	.value {
		font-size: 0.9375rem;
		font-weight: 650;
		white-space: nowrap;
	}
	.title-in {
		animation: title-in 220ms var(--ui);
	}
	@keyframes title-in {
		from {
			opacity: 0;
			transform: translateY(5px);
		}
	}
	@media (prefers-reduced-motion: reduce) {
		.title-in {
			animation: none;
		}
	}
</style>
