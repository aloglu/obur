<script lang="ts">
	import { goto, invalidateAll } from '$app/navigation';
	import { page } from '$app/state';
	import { m } from '#lib/paraglide/messages.js';
	import { api } from '#lib/client/api.ts';
	import { dayHref, logHref } from '#lib/client/links.ts';
	import { deviceZone } from '#lib/client/prefs.ts';
	import { showToast } from '#lib/client/toast.svelte.ts';
	import { addDays, defaultMeal } from '#lib/shared/diary-rules.ts';
	import { MEALS, type DiaryEntry, type Meal } from '#lib/shared/diary-types.ts';
	import { kcal, mealName } from '#lib/shared/format.ts';
	import AmountSheet from '#lib/ui/log/AmountSheet.svelte';
	import EditEntrySheet from '#lib/ui/log/EditEntrySheet.svelte';
	import LogPanel from '#lib/ui/log/LogPanel.svelte';
	import QuickAddSheet from '#lib/ui/log/QuickAddSheet.svelte';
	import BudgetCard from '#lib/ui/today/BudgetCard.svelte';
	import DayHeader from '#lib/ui/today/DayHeader.svelte';
	import MealCard from '#lib/ui/today/MealCard.svelte';
	import NutrientsCard from '#lib/ui/today/NutrientsCard.svelte';
	import WaterCard from '#lib/ui/today/WaterCard.svelte';
	import WeightCard from '#lib/ui/today/WeightCard.svelte';

	let { data } = $props();

	let preset = $state<Meal | null>(null);
	let picking = $state<string | null>(null);
	let quick = $state(false);
	let editing = $state<DiaryEntry | null>(null);
	// Bumped after each save so the desktop Log panel starts fresh for the next food.
	let panelKey = $state(0);
	let highlight = $state<string | undefined>(page.url.searchParams.get('highlight') ?? undefined);

	const eaten = $derived(data.totals.energy_kcal?.value ?? 0);
	const byMeal = $derived(
		Object.fromEntries(
			MEALS.map((meal) => [meal, data.entries.filter((e) => e.meal === meal)])
		) as Record<Meal, DiaryEntry[]>
	);
	const sheetMeal = $derived(preset ?? defaultMeal(new Date(), deviceZone()));

	$effect(() => {
		if (!highlight) return;
		const t = setTimeout(() => (highlight = undefined), 2500);
		return () => clearTimeout(t);
	});

	const move = (days: number) => goto(dayHref(addDays(data.date, days)));
	const isDesktop = () => matchMedia('(min-width: 760px)').matches;

	function add(meal: Meal) {
		if (isDesktop()) preset = meal;
		else goto(logHref(meal, data.date));
	}

	async function logged(entry: DiaryEntry) {
		picking = null;
		quick = false;
		preset = null;
		panelKey += 1;
		if (entry.localDate !== data.date) await goto(dayHref(entry.localDate));
		await invalidateAll();
		highlight = entry.id;
		showToast({
			message: m.toast_logged(),
			detail: m.toast_logged_detail({
				meal: mealName(entry.meal),
				kcal: kcal(entry.nutrients.energy_kcal?.value ?? 0)
			}),
			undo: async () => {
				await api('POST', `/api/v1/diary/entries/${entry.id}?action=delete`, {});
				await invalidateAll();
			}
		});
	}

	async function saved(entry: DiaryEntry, movedTo?: Meal) {
		editing = null;
		await invalidateAll();
		highlight = entry.id;
		showToast({ message: movedTo ? m.toast_moved({ meal: mealName(movedTo) }) : m.toast_saved() });
	}

	async function deleted(entry: DiaryEntry) {
		editing = null;
		await invalidateAll();
		const name =
			entry.kind === 'quick' ? (entry.description ?? m.entry_quick()) : (entry.food?.name ?? '');
		showToast({
			message: m.toast_deleted(),
			detail: m.toast_deleted_detail({ name, meal: mealName(entry.meal) }),
			undo: async () => {
				await api('POST', `/api/v1/diary/entries/${entry.id}?action=restore`, {});
				await invalidateAll();
				highlight = entry.id;
			}
		});
	}

	async function conflict() {
		editing = null;
		showToast({ message: m.toast_conflict() });
		await invalidateAll();
	}
</script>

<svelte:head><title>{m.nav_today()} · {m.app_name()}</title></svelte:head>

<div
	class="mx-auto grid max-w-[1064px] gap-6 px-3.5 py-3 desk:grid-cols-[minmax(0,1fr)_380px] desk:px-7 desk:py-5"
>
	<main class="flex min-w-0 flex-col gap-3">
		<DayHeader date={data.date} today={data.today} onmove={move} />
		<BudgetCard {eaten} budget={null} />
		<NutrientsCard totals={data.totals} entryCount={data.entries.length} />
		<div class="grid grid-cols-1 gap-3 min-[400px]:grid-cols-2">
			<WaterCard date={data.date} totalMl={data.water.totalMl} onchange={invalidateAll} />
			<WeightCard
				date={data.date}
				today={data.today}
				latest={data.latestWeight}
				onchange={invalidateAll}
			/>
		</div>
		{#each MEALS as meal (meal)}
			<MealCard
				{meal}
				entries={byMeal[meal]}
				{highlight}
				onadd={() => add(meal)}
				onopen={(e) => (editing = e)}
			/>
		{/each}
	</main>

	<aside class="hidden desk:block" aria-label={m.log_title()}>
		<div class="sticky top-5 rounded-card bg-surface p-[18px] shadow-card">
			<h2 class="mb-3 text-[22px] font-[750]">{m.log_title()}</h2>
			{#key panelKey}
				<LogPanel
					date={data.date}
					today={data.today}
					{preset}
					onpick={(id) => (picking = id)}
					onquick={() => (quick = true)}
					onclearpreset={() => (preset = null)}
				/>
			{/key}
		</div>
	</aside>
</div>

{#if picking}
	<AmountSheet
		foodId={picking}
		date={data.date}
		today={data.today}
		meal={sheetMeal}
		onsaved={logged}
		onclose={() => (picking = null)}
	/>
{/if}
{#if quick}
	<QuickAddSheet
		date={data.date}
		today={data.today}
		meal={sheetMeal}
		onsaved={logged}
		onclose={() => (quick = false)}
	/>
{/if}
{#if editing}
	<EditEntrySheet
		entry={editing}
		onsaved={saved}
		ondeleted={deleted}
		onconflict={conflict}
		onclose={() => (editing = null)}
	/>
{/if}
