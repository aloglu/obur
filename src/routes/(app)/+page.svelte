<script lang="ts">
	import { goto, invalidateAll } from '$app/navigation';
	import { page } from '$app/state';
	import { m } from '#lib/paraglide/messages.js';
	import { api } from '#lib/client/api.ts';
	import { dayHref, logHref } from '#lib/client/links.ts';
	import { deviceZone } from '#lib/client/prefs.ts';
	import { showToast } from '#lib/client/toast.svelte.ts';
	import { addDays, carbohydrateDay, defaultMeal } from '#lib/shared/diary-rules.ts';
	import type { ActivityEntry } from '#lib/shared/body-types.ts';
	import { MEALS, type DiaryEntry, type Meal } from '#lib/shared/diary-types.ts';
	import { kcal, mealName } from '#lib/shared/format.ts';
	import CircleCheck from '@lucide/svelte/icons/circle-check';
	import { discard, offline } from '#lib/client/offline/sync.svelte.ts';
	import type { QueuedOp } from '#lib/client/offline/store.ts';
	import ActivitySheet from '#lib/ui/log/ActivitySheet.svelte';
	import PendingSheet from '#lib/ui/log/PendingSheet.svelte';
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
	let addingActivity = $state(false);
	let pendingOpen = $state<QueuedOp | null>(null);
	const pendingFor = (meal: Meal) =>
		offline.items.filter(
			(i) =>
				i.preview.kind === 'diary' && i.preview.localDate === data.date && i.preview.meal === meal
		);
	let editing = $state<DiaryEntry | null>(null);
	// Bumped after each save so the desktop Log panel starts fresh for the next food.
	let panelKey = $state(0);
	let panelFocus = $state(0);
	let flash = $state(false);
	$effect(() => {
		if (panelFocus === 0) return;
		flash = true;
		const t = setTimeout(() => (flash = false), 900);
		return () => clearTimeout(t);
	});
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
		// Desktop: the panel is already on screen, so + chooses the meal there and draws the eye to it.
		if (isDesktop()) {
			preset = meal;
			panelFocus += 1;
		} else goto(logHref(meal, data.date));
	}

	async function logged(entry: DiaryEntry | null) {
		picking = null;
		quick = false;
		preset = null;
		panelKey += 1;
		if (!entry) {
			// Kept on this device; it shows as "Waiting to sync" until it reaches the server.
			showToast({ message: m.offline_saved(), detail: m.offline_saved_detail() });
			return;
		}
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

	async function activityAdded(entry: ActivityEntry) {
		addingActivity = false;
		await invalidateAll();
		showToast({
			message: m.toast_activity({ kcal: kcal(entry.kcal) }),
			undo: async () => {
				await api('POST', `/api/v1/body/activity/${entry.id}?action=delete`, {});
				await invalidateAll();
			}
		});
	}

	async function toggleComplete() {
		await api('PUT', `/api/v1/diary/days/${data.date}`, { complete: !data.complete });
		await invalidateAll();
	}

	async function conflict() {
		editing = null;
		showToast({ message: m.toast_conflict() });
		await invalidateAll();
	}
</script>

<svelte:head><title>{m.nav_today()} · {m.app_name()}</title></svelte:head>

<!-- Desktop: the day header sits in the first row, so the Log panel starts level with the Budget card. -->
<div
	class="mx-auto grid max-w-[1064px] gap-6 px-3.5 py-3 desk:grid-cols-[minmax(0,1fr)_380px] desk:gap-x-6 desk:gap-y-3 desk:px-7 desk:py-5"
>
	<main class="flex min-w-0 flex-col gap-3 desk:row-span-2 desk:grid desk:grid-rows-subgrid">
		<DayHeader date={data.date} today={data.today} onmove={move} />
		<div class="flex min-w-0 flex-col gap-3">
			<BudgetCard
				{eaten}
				budget={data.budget}
				manual={data.target?.mode === 'manual'}
				floor={data.target?.floorKcal ?? 0}
				onaddactivity={() => (addingActivity = true)}
			/>
			<NutrientsCard
				totals={data.totals}
				carbs={carbohydrateDay(data.entries)}
				entryCount={data.entries.length}
				targets={data.macros}
			/>
			<div class="grid grid-cols-1 gap-3 min-[400px]:grid-cols-2">
				<WaterCard
					date={data.date}
					today={data.today}
					entries={data.water.entries}
					totalMl={data.water.totalMl}
					onchange={invalidateAll}
				/>
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
					pending={pendingFor(meal)}
					onpending={(op) => (pendingOpen = op)}
				/>
			{/each}
			<div class="flex flex-col items-start gap-1 px-1">
				<button
					type="button"
					onclick={toggleComplete}
					aria-pressed={data.complete}
					class={[
						'inline-flex min-h-11 items-center gap-2 rounded-full border px-4 text-[15px] font-bold',
						data.complete ? 'border-good bg-surface text-good' : 'border-line bg-surface text-text'
					]}
				>
					<CircleCheck size={20} aria-hidden="true" />{data.complete
						? m.day_completed()
						: m.day_complete()}
				</button>
				<p class="text-[13px] text-muted">{m.day_complete_hint()}</p>
			</div>
		</div>
	</main>

	<aside class="hidden desk:col-start-2 desk:row-start-2 desk:block" aria-label={m.log_title()}>
		<div
			class={[
				'sticky top-5 rounded-card bg-surface p-[18px] shadow-card outline-3 outline-offset-2 transition-[outline-color] duration-300',
				flash ? 'outline-accent' : 'outline-transparent'
			]}
		>
			<h2 class="mb-3 text-[22px] font-[750]">{m.log_title()}</h2>
			{#key panelKey}
				<LogPanel
					date={data.date}
					today={data.today}
					{preset}
					onpick={(id) => (picking = id)}
					onquick={() => (quick = true)}
					onclearpreset={() => (preset = null)}
					presetRequest={panelFocus}
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
{#if addingActivity}
	<ActivitySheet
		date={data.date}
		onsaved={activityAdded}
		onclose={() => (addingActivity = false)}
	/>
{/if}
{#if pendingOpen}
	<PendingSheet
		op={pendingOpen}
		ondiscard={async () => {
			await discard(pendingOpen!.seq!);
			pendingOpen = null;
		}}
		onclose={() => (pendingOpen = null)}
	/>
{/if}
