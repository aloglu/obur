<script lang="ts">
	// The history below the calendar (docs/ui.md, "Progress"; owner's choice 2026-10-31). Phone: Weight, Calories and
	// Nutrients tabs with the range dropdown beside them, one topic at a time. Desktop: no tabs; the three cards sit
	// in the page grid beside the calendar (this wrapper is `display: contents` there) and the range is in the header.
	import { m } from '#lib/paraglide/messages.js';
	import { dateWithYear, kcal } from '#lib/shared/format.ts';
	import type { ProgressHistory } from '#lib/shared/history.ts';
	import { formatDecimal } from '#lib/shared/numbers.ts';
	import { MediaQuery } from 'svelte/reactivity';
	import CaloriesChart from './CaloriesChart.svelte';
	import { dayNumber } from './history-axis.ts';
	import RangeSelect from './RangeSelect.svelte';
	import WeightChart from './WeightChart.svelte';

	interface Props {
		history: ProgressHistory;
		onrange: (range: string) => void;
	}
	let { history, onrange }: Props = $props();

	type Tab = 'weight' | 'calories' | 'nutrients';
	const TABS: { id: Tab; label: () => string }[] = [
		{ id: 'weight', label: m.history_tab_weight },
		{ id: 'calories', label: m.history_tab_calories },
		{ id: 'nutrients', label: m.history_tab_nutrients }
	];
	let tab = $state<Tab>('weight');
	const uid = $props.id();

	// Weights always with one decimal ("83,0 kg"), as the person reads a scale.
	const kg = (v: number) => v.toFixed(1).replace('.', ',');
	// Desktop shows every panel; a phone only the chosen tab. A panel is built only when shown, so its chart
	// measures its real width.
	const wide = new MediaQuery('min-width: 760px', false);
	const shown = (id: Tab) => wide.current || tab === id;
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

	const points = $derived(history.weight.points);
	const last = $derived(points.at(-1));
	const change = $derived(
		last ? last.trend - (history.weight.trendBefore ?? points[0].trend) : null
	);
	const weeks = $derived((dayNumber(history.to) - dayNumber(history.from) + 1) / 7);
	const a = $derived(history.averages);
	const daysUnder = $derived(a.againstBudget.days - a.overBudgetDays);

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

	const card = 'flex min-w-0 flex-col gap-3 rounded-card bg-surface p-[18px] shadow-card';

	const heading = 'text-[19px] font-bold max-desk:sr-only';
	const rows = 'flex flex-col divide-y divide-line text-[14px]';
	const row = 'flex justify-between gap-3 py-2.5';
</script>

<div class="flex flex-col gap-3 desk:contents">
	<div class="flex items-center gap-2 desk:hidden">
		<div
			role="tablist"
			aria-label={m.history_tabs()}
			class="flex min-w-0 flex-1 gap-1 rounded-[14px] bg-surface2 p-1"
		>
			{#each TABS as t (t.id)}
				<button
					type="button"
					role="tab"
					id="{uid}-tab-{t.id}"
					aria-selected={tab === t.id}
					aria-controls="{uid}-panel-{t.id}"
					onclick={() => (tab = t.id)}
					class={[
						'min-h-11 min-w-0 flex-1 truncate rounded-[10px] px-1 text-[14px] font-[650]',
						tab === t.id ? 'bg-surface text-text shadow-card' : 'text-muted'
					]}>{t.label()}</button
				>
			{/each}
		</div>
		<RangeSelect id="{uid}-range-phone" value={history.range} onchange={onrange} />
	</div>

	{#if shown('weight')}
		<div id="{uid}-panel-weight" role="tabpanel" aria-labelledby="{uid}-tab-weight" class={card}>
			<h2 class={heading}>{m.history_tab_weight()}</h2>
			{#if last && change !== null}
				<div class="flex flex-wrap items-end justify-between gap-2.5">
					<div>
						<p class="m-0 text-[12px] font-bold tracking-[0.06em] text-muted uppercase">
							{m.history_trend_now()}
						</p>
						<p
							class="m-0 font-display text-[34px] leading-none font-extrabold tracking-[-0.02em] tabular-nums"
						>
							{kg(last.trend)}<small
								class="ml-1 font-sans text-[15px] font-semibold tracking-normal text-muted"
								>kg</small
							>
						</p>
					</div>
					<p class="m-0 text-right text-[14px]">
						<b class="tabular-nums">{signed(change, kg)} kg</b><br /><span class="text-muted"
							>{within}</span
						>
					</p>
				</div>
			{/if}
			<WeightChart {points} from={history.from} to={history.to} goalKg={history.weight.goalKg} />
			{#if last && change !== null}
				<div class={rows}>
					{#if history.weight.goalKg !== null && last.trend > history.weight.goalKg}
						<div class={row}>
							<span>{m.history_to_goal({ goal: kg(history.weight.goalKg) })}</span>
							<b class="tabular-nums">{kg(last.trend - history.weight.goalKg)} kg</b>
						</div>
					{/if}
					<div class={row}>
						<span>{m.history_per_week()}</span><b class="tabular-nums"
							>{signed(change / weeks, kg)} kg</b
						>
					</div>
					<div class={row}>
						<span>{m.history_weighins()}</span><b class="tabular-nums">{a.weighIns}</b>
					</div>
					<div class={row}>
						<span>{m.history_lowest()}</span>
						<b class="tabular-nums">{kg(Math.min(...points.map((p) => p.weight)))} kg</b>
					</div>
				</div>
			{/if}
		</div>
	{/if}

	{#if shown('calories')}
		<div
			id="{uid}-panel-calories"
			role="tabpanel"
			aria-labelledby="{uid}-tab-calories"
			class={card}
		>
			<h2 class={heading}>{m.history_tab_calories()}</h2>
			{#if a.eatenKcal.value !== null}
				<div class="flex flex-wrap items-end justify-between gap-2.5">
					<div>
						<p class="m-0 text-[12px] font-bold tracking-[0.06em] text-muted uppercase">
							{m.history_average_day()}
						</p>
						<p
							class="m-0 font-display text-[34px] leading-none font-extrabold tracking-[-0.02em] tabular-nums"
						>
							{kcal(a.eatenKcal.value)}<small
								class="ml-1 font-sans text-[15px] font-semibold tracking-normal text-muted"
								>kcal</small
							>
						</p>
					</div>
					{#if a.againstBudget.value !== null}
						{@const over = a.againstBudget.value > 0}
						<span
							class={[
								'rounded-full px-2.5 py-1 text-[13px] font-bold',
								over ? 'bg-bad/15 text-bad' : 'bg-good/15 text-good'
							]}
							>{over
								? m.history_over({ kcal: kcal(a.againstBudget.value) })
								: m.history_under({ kcal: kcal(-a.againstBudget.value) })}</span
						>
					{/if}
				</div>
			{/if}
			<p class="m-0 text-[13px] text-muted">
				{history.weekly ? m.history_bars_weekly() : m.history_bars_daily()}
			</p>
			<CaloriesChart
				bars={history.bars}
				weekly={history.weekly}
				from={history.from}
				to={history.to}
			/>
			<div class={rows}>
				<div class={row}>
					<span>{m.history_days_under()}</span><b class="tabular-nums">{daysUnder}</b>
				</div>
				<div class={row}>
					<span>{m.history_days_over()}</span><b class="tabular-nums">{a.overBudgetDays}</b>
				</div>
				<div class={row}>
					<span>{m.history_water()}</span>
					<b class="tabular-nums"
						>{a.waterMl.value === null
							? '–'
							: `${formatDecimal(a.waterMl.value / 1000, ',', 1)} l`}</b
					>
				</div>
			</div>
			<p class="m-0 text-[12px] text-muted">
				{a.completeDays
					? m.history_basis({ days: String(a.completeDays) })
					: m.history_basis_none()}
			</p>
		</div>
	{/if}

	{#if shown('nutrients')}
		<div
			id="{uid}-panel-nutrients"
			role="tabpanel"
			aria-labelledby="{uid}-tab-nutrients"
			class={card}
		>
			<h2 class={heading}>{m.history_tab_nutrients()}</h2>
			<p class="m-0 text-[12px] font-bold tracking-[0.06em] text-muted uppercase">
				{m.history_average_day()}
			</p>
			<div class="flex flex-col gap-2.5">
				{#each macroRows as r (r.key)}
					{@const value = r.avg.value}
					<div class="grid grid-cols-[88px_minmax(0,1fr)_auto] items-center gap-2.5 text-[14px]">
						<span class="truncate">{r.name}</span>
						<span
							class={['h-2.5 overflow-hidden rounded-full', r.target && 'bg-track']}
							aria-hidden="true"
						>
							{#if value !== null && r.target}<span
									class="block h-full rounded-full {r.color}"
									style:width="{Math.min(100, (value / r.target) * 100)}%"
								></span>{/if}
						</span>
						<b class="text-right tabular-nums"
							>{value === null
								? m.history_unknown()
								: r.target
									? m.history_macro_of({
											value: String(Math.round(value)),
											target: String(r.target)
										})
									: m.history_macro_value({ value: String(Math.round(value)) })}</b
						>
					</div>
				{/each}
			</div>
			{#each coverage as note (note)}<p class="m-0 text-[12px] text-muted">{note}</p>{/each}
			<p class="m-0 text-[12px] text-muted">
				{a.completeDays
					? m.history_basis({ days: String(a.completeDays) })
					: m.history_basis_none()}
				{#if history.macros}{m.history_targets_note()}{/if}
			</p>
		</div>
	{/if}
</div>
