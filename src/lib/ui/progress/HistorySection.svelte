<script lang="ts">
	// The history on Progress (docs/ui.md, "Progress charts"): Weight, Calories and Nutrients tabs on every screen, one
	// topic at a time in one card. Each topic's headline is also the chart's readout: it follows the finger while
	// looking at a point, and goes back to the range's figure on release.
	import { m } from '#lib/paraglide/messages.js';
	import { dateWithYear, dayAndMonth, kcal, shortDate } from '#lib/shared/format.ts';
	import type { CalorieBar, ProgressHistory, WeightPoint } from '#lib/shared/history.ts';
	import { formatDecimal } from '#lib/shared/numbers.ts';
	import { onMount } from 'svelte';
	import Roll from '../Roll.svelte';
	import CaloriesChart from './CaloriesChart.svelte';
	import { dayNumber } from './history-axis.ts';
	import WeightChart from './WeightChart.svelte';

	interface Props {
		history: ProgressHistory;
	}
	let { history }: Props = $props();

	type Tab = 'weight' | 'calories' | 'nutrients';
	const TABS: { id: Tab; label: () => string }[] = [
		{ id: 'weight', label: m.history_tab_weight },
		{ id: 'calories', label: m.history_tab_calories },
		{ id: 'nutrients', label: m.history_tab_nutrients }
	];
	let tab = $state<Tab>('weight');
	const tabAt = $derived(TABS.findIndex((t) => t.id === tab));
	const uid = $props.id();

	// Weights always with one decimal ("83,0 kg"), as the person reads a scale.
	const kg = (v: number) => v.toFixed(1).replace('.', ',');
	const signed = (v: number, f: (n: number) => string) =>
		`${v > 0 ? '+' : v < 0 ? '−' : '±'}${f(Math.abs(v))}`;
	const within = $derived(
		history.range === 'All'
			? m.history_in_All({ date: dateWithYear(history.from) })
			: {
					'1W': m.history_in_1W,
					'1M': m.history_in_1M,
					'3M': m.history_in_3M,
					'1Y': m.history_in_1Y
				}[history.range]()
	);

	// Readings (what was weighed) or Trend (the smoothed weight and pace; docs/feasibility.md, "Weight trend").
	// Remembered on this device; storage may be unavailable, and then Readings shows.
	type WeightView = 'readings' | 'trend';
	const VIEW_KEY = 'obur:history-weight-view';
	let view = $state<WeightView>('readings');
	onMount(() => {
		try {
			if (localStorage.getItem(VIEW_KEY) === 'trend') view = 'trend';
		} catch {
			// Storage blocked: keep Readings.
		}
	});
	function setView(next: WeightView) {
		view = next;
		try {
			localStorage.setItem(VIEW_KEY, next);
		} catch {
			// Not remembered on this device; the choice still applies now.
		}
	}

	const points = $derived(history.weight.points);
	const first = $derived(points[0]);
	const last = $derived(points.at(-1));
	/** Readings: from the first weigh-in in the range to the latest. */
	const readingChange = $derived(first && last ? last.weight - first.weight : null);
	const readingDays = $derived(first && last ? dayNumber(last.date) - dayNumber(first.date) : 0);
	/** Trend: from the smoothed weight before the range (or at its first weigh-in) to now. */
	const trendChange = $derived(
		first && last ? last.trend - (history.weight.trendBefore ?? first.trend) : null
	);
	const VIEWS: WeightView[] = ['readings', 'trend'];
	const a = $derived(history.averages);
	const daysUnder = $derived(a.againstBudget.days - a.overBudgetDays);

	let lookedAt = $state<WeightPoint | null>(null);
	const weightValue = $derived.by(() => {
		const point = lookedAt ?? last;
		return point ? kg(view === 'trend' ? point.trend : point.weight) : '';
	});
	const weightSub = $derived.by(() => {
		if (lookedAt) {
			const day = dayAndMonth(lookedAt.date);
			return view === 'trend' ? m.history_look_smoothed({ day }) : day;
		}
		if (!first || !last) return '';
		if (view === 'trend')
			return `${m.history_pace({ pace: signed(last.pacePerWeek, kg) })} ${m.history_a_week()}`;
		if (readingChange === null || points.length < 2) return '';
		return `${signed(readingChange, kg)} kg ${m.history_since({ date: shortDate(first.date) })}`;
	});

	let lookedBar = $state<CalorieBar | null>(null);
	const completeDays = (count: number) =>
		count === 1 ? m.history_complete_day() : m.history_complete_days({ count: String(count) });
	const calorieLabel = $derived.by(() => {
		if (!lookedBar) return m.history_average_day();
		return history.weekly
			? m.history_week({ date: shortDate(lookedBar.from) })
			: dayAndMonth(lookedBar.from);
	});
	const calorieValue = $derived.by(() => {
		const value = lookedBar ? lookedBar.eatenKcal : a.eatenKcal.value;
		return value === null ? '–' : kcal(value);
	});
	function barSub(b: CalorieBar): string {
		if (b.eatenKcal === null) return m.journal_nothing_logged();
		let text = m.history_no_budget();
		if (b.budgetKcal !== null) {
			const args = { budget: kcal(b.budgetKcal), diff: kcal(Math.abs(b.eatenKcal - b.budgetKcal)) };
			text = b.eatenKcal > b.budgetKcal ? m.history_of_over(args) : m.history_of_under(args);
		}
		if (history.weekly)
			return m.history_days_logged({ text, logged: String(b.loggedDays), days: String(b.days) });
		return b.complete ? text : m.history_bar_incomplete({ text });
	}
	const calorieSub = $derived.by(() => {
		if (lookedBar) return barSub(lookedBar);
		if (!a.completeDays) return m.history_basis_none();
		const diff = a.againstBudget.value;
		if (diff === null) return m.history_basis({ days: completeDays(a.completeDays) });
		const args = { kcal: kcal(Math.abs(diff)), days: completeDays(a.completeDays) };
		return diff > 0 ? m.history_sub_over(args) : m.history_sub_under(args);
	});

	/** One coverage note for the macros known on fewer days than were counted, merged when the counts match. */
	const coverage = $derived.by(() => {
		const partial = macroRows.filter((r) => r.avg.days < a.completeDays);
		const byDays: Record<number, string[]> = {};
		for (const r of partial) (byDays[r.avg.days] ??= []).push(r.name);
		return Object.entries(byDays).map(([known, names]) =>
			m.history_coverage({
				nutrient: names.map((n, i) => (i ? n.toLowerCase() : n)).join(', '),
				known,
				days: String(a.completeDays)
			})
		);
	});
	const macroRows = $derived([
		{
			key: 'protein',
			name: m.nutrient_short_protein(),
			color: 'bg-protein',
			avg: a.protein,
			target: history.macros?.proteinG
		},
		{
			key: 'carbohydrate',
			name: m.nutrient_short_carbohydrate(),
			color: 'bg-carb',
			avg: a.carbohydrate,
			target: history.macros?.carbohydrateG
		},
		{
			key: 'fat',
			name: m.nutrient_short_fat(),
			color: 'bg-fat',
			avg: a.fat,
			target: history.macros?.fatG
		}
	]);

	const big =
		'font-display text-[40px] leading-none font-extrabold tracking-[-0.03em] tabular-nums';
	const unit = 'text-[15px] font-[650] text-muted';
	const sub = 'mt-1 min-h-5 text-[14px] text-muted tabular-nums';
	const rows = 'flex flex-col divide-y divide-line text-[14px] text-muted';
	const row = 'flex justify-between gap-3 py-2.5';
	const value = 'font-[650] text-text tabular-nums';
</script>

{#snippet weightRows(v: WeightView)}
	{@const current = v === 'trend' ? last!.trend : last!.weight}
	{#if history.weight.goalKg !== null && current > history.weight.goalKg}
		<div class={row}>
			<span>{m.history_to_goal({ goal: kg(history.weight.goalKg) })}</span>
			<b class={value}>{kg(current - history.weight.goalKg)} kg</b>
		</div>
	{/if}
	{#if v === 'trend' && trendChange !== null}
		<div class={row}>
			<span>{m.history_change_in({ within })}</span>
			<b class={value}>{signed(trendChange, kg)} kg</b>
		</div>
	{:else if v === 'readings' && readingChange !== null && readingDays >= 7}
		<div class={row}>
			<span>{m.history_per_week()}</span>
			<b class={value}>{signed(readingChange / (readingDays / 7), kg)} kg</b>
		</div>
	{/if}
	<div class={row}>
		<span>{m.history_weighins()}</span><b class={value}>{a.weighIns}</b>
	</div>
	{#if v === 'readings'}
		<div class={row}>
			<span>{m.history_lowest()}</span>
			<b class={value}>{kg(Math.min(...points.map((p) => p.weight)))} kg</b>
		</div>
	{/if}
{/snippet}

<div
	role="tablist"
	aria-label={m.history_tabs()}
	class="tabs relative grid grid-cols-3 rounded-[14px] bg-surface2 p-1"
	style:--at={tabAt}
>
	<span class="thumb" aria-hidden="true"></span>
	{#each TABS as t (t.id)}
		<button
			type="button"
			role="tab"
			id="{uid}-tab-{t.id}"
			aria-selected={tab === t.id}
			aria-controls="{uid}-panel"
			onclick={() => (tab = t.id)}
			class={[
				'relative z-1 min-h-11 min-w-0 truncate rounded-[10px] px-1 text-[14px] font-[650] transition-colors',
				tab === t.id ? 'text-text' : 'text-muted'
			]}>{t.label()}</button
		>
	{/each}
</div>

<div
	id="{uid}-panel"
	role="tabpanel"
	aria-labelledby="{uid}-tab-{tab}"
	class="flex min-w-0 flex-col rounded-card bg-surface p-[18px] shadow-card"
>
	{#if tab === 'weight'}
		<h2 class="sr-only">{m.history_tab_weight()}</h2>
		{#if first && last}
			<!-- The label above the weight is the switch: both names, the one shown dark, the other faint. Each keeps a 44 px
			     tap area without adding height. -->
			<div
				role="radiogroup"
				aria-label={m.history_view()}
				class="-mx-2 -my-3 flex items-center gap-0.5 self-start text-[13px] font-[650]"
			>
				{#each VIEWS as v, i (v)}
					{#if i > 0}<span class="h-3.5 w-px bg-line" aria-hidden="true"></span>{/if}
					<button
						type="button"
						role="radio"
						aria-checked={view === v}
						onclick={() => setView(v)}
						class={[
							'min-h-11 px-2 transition-[color,opacity]',
							view === v ? 'text-text' : 'text-muted opacity-65 hover:opacity-100'
						]}>{v === 'trend' ? m.history_smoothed_short() : m.history_latest()}</button
					>
				{/each}
			</div>
			<p class="mt-2 flex items-baseline gap-1.5">
				<span class={big}><Roll value={weightValue} /></span><span class={unit}>kg</span>
			</p>
			<p class={sub}>{weightSub}</p>
		{/if}
		<div class="mt-2.5">
			<WeightChart
				{points}
				mode={view}
				from={history.from}
				to={history.to}
				goalKg={history.weight.goalKg}
				onlook={(point) => (lookedAt = point)}
			/>
		</div>
		{#if first && last}
			<!-- Both views' rows share one cell, so switching never changes the card's height. -->
			<div class="mt-2 grid">
				{#each VIEWS as v (v)}
					<div
						class={[rows, '[grid-area:1/1]', v !== view && 'invisible']}
						aria-hidden={v !== view}
						inert={v !== view}
					>
						{@render weightRows(v)}
					</div>
				{/each}
			</div>
		{/if}
	{:else if tab === 'calories'}
		<h2 class="sr-only">{m.history_tab_calories()}</h2>
		<p class="text-[13px] font-[650] text-muted">{calorieLabel}</p>
		<p class="mt-2 flex items-baseline gap-1.5">
			<span class={big}><Roll value={calorieValue} /></span><span class={unit}>kcal</span>
		</p>
		<p class={sub}>{calorieSub}</p>
		<div class="mt-2.5">
			<CaloriesChart
				bars={history.bars}
				weekly={history.weekly}
				from={history.from}
				to={history.to}
				onlook={(bar) => (lookedBar = bar)}
			/>
		</div>
		<div class={[rows, 'mt-2']}>
			<div class={row}>
				<span>{m.history_days_under()}</span><b class={value}>{daysUnder}</b>
			</div>
			<div class={row}>
				<span>{m.history_days_over()}</span><b class={value}>{a.overBudgetDays}</b>
			</div>
			<div class={row}>
				<span>{m.history_water()}</span>
				<b class={value}
					>{a.waterMl.value === null
						? '–'
						: `${formatDecimal(a.waterMl.value / 1000, ',', 1)} l`}</b
				>
			</div>
		</div>
	{:else}
		<h2 class="sr-only">{m.history_tab_nutrients()}</h2>
		<p class="text-[13px] font-[650] text-muted">{m.history_average_complete()}</p>
		<div class="mt-3.5 flex flex-col gap-3">
			{#each macroRows as r (r.key)}
				{@const amount = r.avg.value}
				<div class="grid grid-cols-[72px_minmax(0,1fr)_auto] items-center gap-2.5 text-[14px]">
					<span class="truncate">{r.name}</span>
					<span
						class={['h-2 overflow-hidden rounded-full', r.target && 'bg-track']}
						aria-hidden="true"
					>
						{#if amount !== null && r.target}<span
								class="macro block h-full rounded-full {r.color}"
								style:width="{Math.min(100, (amount / r.target) * 100)}%"
							></span>{/if}
					</span>
					<b class="text-right font-[650] tabular-nums"
						>{amount === null
							? m.history_unknown()
							: r.target
								? m.history_macro_of({
										value: String(Math.round(amount)),
										target: String(r.target)
									})
								: m.history_macro_value({ value: String(Math.round(amount)) })}</b
					>
				</div>
			{/each}
		</div>
		{#each coverage as note (note)}<p class="mt-3 text-[13px] text-muted">{note}</p>{/each}
		<p class="mt-3 text-[13px] text-muted">
			{a.completeDays
				? m.history_basis({ days: completeDays(a.completeDays) })
				: m.history_basis_none()}
			{#if history.macros}{m.history_targets_note()}{/if}
		</p>
	{/if}
</div>

<style>
	.thumb {
		position: absolute;
		top: 4px;
		bottom: 4px;
		left: 4px;
		width: calc((100% - 8px) / 3);
		border-radius: 10px;
		background: var(--surface);
		box-shadow: 0 1px 3px rgba(0, 0, 0, 0.12);
		transform: translateX(calc(100% * var(--at)));
		transition: transform 380ms var(--travel);
	}
	.macro {
		animation: macro-in 600ms var(--travel);
		transform-origin: left;
	}
	@keyframes macro-in {
		from {
			transform: scaleX(0);
		}
	}
	@media (prefers-reduced-motion: reduce) {
		.thumb {
			transition: none;
		}
		.macro {
			animation: none;
		}
	}
</style>
